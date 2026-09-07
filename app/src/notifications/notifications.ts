// The notifications port (same pattern as the billing port, ADR-0009 §4).
// The app talks to the OS notification surface ONLY through this
// interface; screens and stores never import the SDK. The one
// implementation is the expo-notifications adapter — local notifications
// are fully on-device, so the airplane-mode rule holds by construction:
// nothing here ever touches the network. Tests mock this port.

import { expoNotificationsPort } from "./expo-notifications";

/** The three arrival slots for the one daily invitation. */
export type ReminderSlot = "morning" | "midday" | "evening";

/** Render/edit order for the slot options — matches strings.notifications.time. */
export const REMINDER_SLOTS: readonly ReminderSlot[] = [
  "morning",
  "midday",
  "evening",
];

/**
 * The real local arrival time of each slot. These are FACTS the copy
 * states out loud — strings.notifications.time labels name these exact
 * hours ("Morning (8:00)"), so a change here must change those labels
 * with it (a test pins the two together).
 */
export const SLOT_TIMES: Record<ReminderSlot, { hour: number; minute: number }> =
  {
    morning: { hour: 8, minute: 0 },
    midday: { hour: 12, minute: 30 },
    evening: { hour: 18, minute: 30 },
  };

/**
 * OS permission, in the app's terms. "undetermined" means the OS dialog
 * has never been shown — the only state where requesting shows UI.
 */
export type PermissionState = "undetermined" | "granted" | "denied";

export interface NotificationsPort {
  /** Current OS permission, without showing any UI. */
  getPermission(): Promise<PermissionState>;
  /** Show the OS permission dialog (or resolve instantly if decided). */
  requestPermission(): Promise<PermissionState>;
  /**
   * Schedule the one daily invitation at the slot's local time,
   * replacing any previous schedule — there is never more than one
   * invitation a day, whatever was scheduled before.
   *
   * `tomorrowBody` is the body of TOMORROW's firing (ADR-0018: the
   * invitation may name the streak). It is computed by the caller from
   * today's history at scheduling time, which is why it belongs to
   * tomorrow and never to a firing later today: both streak bodies speak
   * from the day after today ("today's session would make it N",
   * "still going"), so a firing later today would misreport whenever she
   * has already trained. Later today (if the slot has not passed) and
   * the other five days keep the rotating generic bodies.
   */
  scheduleDaily(slot: ReminderSlot, tomorrowBody: string): Promise<void>;
  /** Cancel every scheduled invitation ("No invitation"). */
  cancelAll(): Promise<void>;
}

/** The active notifications implementation. */
export function getNotifications(): NotificationsPort {
  return expoNotificationsPort;
}
