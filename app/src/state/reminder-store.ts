// The daily-invitation record (launch-checklist notification rules). Two
// persisted facts: whether we have EVER asked her in-app (`asked` guards
// the one in-context ask — once, after her first completed session,
// never again), and which slot the invitation is scheduled at (null =
// no invitation). All OS work goes through the notifications port; the
// scheduling itself is local-only, so this store works in airplane mode
// like every sibling. Never a nag: a decline anywhere sets `asked` and
// nothing ever re-prompts — the Settings section is the only way back in.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getNotifications, type ReminderSlot } from "../notifications/notifications";

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
          await getNotifications().scheduleDaily(slot);
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
          set({ permissionDenied: permission === "denied" });
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
 * Whether the one in-context ask is still owed. Requires hydration —
 * before the persisted `asked` is known we fail SAFE toward never
 * nagging (no ask), which costs nothing: the next completed session
 * asks instead.
 */
export function reminderAskDue(): boolean {
  const state = useReminderStore.getState();
  return state.hydrated && !state.asked;
}
