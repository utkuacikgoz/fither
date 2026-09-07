// The daily-invitation record (launch-checklist notification rules). Two
// persisted facts: whether we have EVER asked her in-app (`asked` guards
// the one in-context ask — once, after her first completed session,
// never again), and which slot the invitation is scheduled at (null =
// no invitation). All OS work goes through the notifications port; the
// scheduling itself is local-only, so this store works in airplane mode
// like every sibling. Never a nag: a decline anywhere sets `asked` and
// nothing ever re-prompts — the Settings section is the only way back in.
//
// The invitation names the week (owner brief 2026-09-07, wave 2: streak
// pressure is out of the reminders). Every schedule here passes
// tomorrow's body, computed from today's history at that moment: the
// engine's `weekParticipation` and the intention she holds, read through
// the one `weekView` selector and worded by `invitationBody`. All of it is
// on-device data — airplane mode changes nothing.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { todayIso } from "../lib/dates";
import { invitationBody } from "../notifications/invitation-body";
import { getNotifications, type ReminderSlot } from "../notifications/notifications";
import { useIntentionStore } from "./intention-store";
import { useProfileStore } from "./profile-store";
import { weekView } from "./week-view";

interface ReminderState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** The in-context ask has run (allowed OR declined). Once ever. */
  asked: boolean;
  /**
   * Her last slot tap in Settings was answered by an OS denial — the
   * dialog no longer appears, so nothing in-app acknowledged the tap
   * (wave-C flag). Settings shows the one honest line while this holds.
   * Deliberately NOT persisted: the OS is the truth, and she may turn
   * notifications on in iOS Settings between launches; the flag clears
   * the moment a grant or "No invitation" answers the section instead.
   */
  permissionDenied: boolean;
  /** The scheduled slot, or null for no invitation. */
  slot: ReminderSlot | null;
  /** "Not now" on our ask: never ask again, schedule nothing. */
  decline: () => void;
  /**
   * "Sounds good" on our ask: mark asked (whatever the OS dialog says —
   * an OS decline is also final for in-app asking), then request the OS
   * permission. True iff granted, i.e. the time question may follow.
   */
  allow: () => Promise<boolean>;
  /**
   * Schedule the invitation at a slot (permission already granted).
   * Records the slot only when scheduling actually succeeded.
   */
  chooseSlot: (slot: ReminderSlot) => Promise<boolean>;
  /**
   * The Settings path: she picked a slot herself, so if permission was
   * never granted this requests it right here — in context, at her own
   * initiative. Schedules on grant; on denial nothing schedules and the
   * section honestly keeps "No invitation" selected (the OS dialog she
   * just answered is the feedback).
   */
  chooseSlotWithPermission: (slot: ReminderSlot) => Promise<boolean>;
  /** "No invitation": clear the slot and cancel the schedule. */
  disable: () => Promise<void>;
}

export const useReminderStore = create<ReminderState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      hydrationFailed: false,
      asked: false,
      slot: null,
      permissionDenied: false,

      decline: () => set({ asked: true }),

      allow: async () => {
        set({ asked: true });
        try {
          return (await getNotifications().requestPermission()) === "granted";
        } catch {
          // A failed native call is treated as not granted — never a
          // crash, never a retry loop. Settings remains the way in.
          return false;
        }
      },

      chooseSlot: async (slot) => {
        try {
          await getNotifications().scheduleDaily(slot, currentInvitationBody());
        } catch {
          return false;
        }
        set({ slot, asked: true });
        return true;
      },

      chooseSlotWithPermission: async (slot) => {
        // She engaged with the section herself; the in-context ask must
        // never appear after this, granted or not.
        set({ asked: true });
        try {
          let permission = await getNotifications().getPermission();
          if (permission !== "granted") {
            permission = await getNotifications().requestPermission();
          }
          if (permission === "denied") {
            // The OS will deliver nothing now, whatever was scheduled
            // before: an earlier slot still shown as selected under the
            // "turn it on in Settings" line would be a lie (reviewer
            // note). "No invitation" is the honest selection.
            set({ permissionDenied: true, slot: null });
            return false;
          }
          set({ permissionDenied: false });
          if (permission !== "granted") return false;
        } catch {
          return false;
        }
        return get().chooseSlot(slot);
      },

      disable: async () => {
        // Clear the state first — her tap answers immediately; the OS
        // cancellation is local and near-instant, but never gates the UI.
        set({ slot: null, permissionDenied: false });
        try {
          await getNotifications().cancelAll();
        } catch {
          // Best effort; a re-tap (or any later reschedule) replaces the
          // schedule wholesale via scheduleDaily's cancel-first contract.
        }
      },
    }),
    {
      name: "fither/reminders-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        asked: state.asked,
        slot: state.slot,
      }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useReminderStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);

/**
 * Tomorrow's invitation body from today's history. The date is the
 * app's local calendar day (the same boundary the prompt uses); the
 * week's participation and the intention verdict are read through
 * `weekView`, never re-derived here. Before the profile store hydrates
 * the history is empty, which simply yields the generic body — never a
 * wrong count.
 */
function currentInvitationBody(): string {
  const { entries } = useProfileStore.getState().history;
  const { target } = useIntentionStore.getState();
  const { participation } = weekView(entries, todayIso(), target);
  return invitationBody({
    participation,
    target,
    hasHistory: entries.length > 0,
  });
}

/**
 * Refresh the scheduled invitation so tomorrow's body reflects today's
 * training. Called after a session commits (session-store) and on every
 * return to the foreground (the root layout). The foreground call is
 * what keeps the count honest across a date or timezone change: the
 * body's "N of T this week" is a fact at scheduling time only, and the
 * OS repeats a weekly trigger verbatim, so a new week, a week away, a
 * flight across the date line or a clock set forward would otherwise
 * replay a stale count. Re-reading `todayIso()` at each foreground puts
 * the body back on the week the device is now in. Best effort, never
 * throws: nothing happens unless a slot is chosen AND the OS permission
 * is granted, and any failure leaves the previous schedule standing —
 * the finish flow must never wait on, or hear about, a notification.
 */
export async function rescheduleInvitation(): Promise<void> {
  const { slot } = useReminderStore.getState();
  if (slot === null) return;
  try {
    const notifications = getNotifications();
    if ((await notifications.getPermission()) !== "granted") return;
    await notifications.scheduleDaily(slot, currentInvitationBody());
  } catch {
    // Best effort by contract; the next commit or slot choice tries again.
  }
}

/**
 * Whether the one in-context ask is still owed. Requires hydration —
 * before the persisted `asked` is known we fail SAFE toward never
 * nagging (no ask), which costs nothing: the next completed session
 * asks instead.
 */
export function reminderAskDue(): boolean {
  const state = useReminderStore.getState();
  return state.hydrated && !state.asked;
}
