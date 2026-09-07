// The expo-notifications adapter behind the notifications port. Local
// notifications only — scheduling, permission and cancellation all run
// on-device with zero network, so airplane mode changes nothing here.
//
// Deliberately NO foreground presentation handler: the invitation exists
// to open the app; while she is already inside it, showing a banner over
// a session would be noise (the session is sacred). If she is in the app
// at the slot time, the notification simply doesn't present.

import { PermissionStatus } from "expo";
import * as Notifications from "expo-notifications";

import { strings } from "../copy/strings";
import {
  SLOT_TIMES,
  type NotificationsPort,
  type PermissionState,
  type ReminderSlot,
} from "./notifications";

/**
 * The four interchangeable invitation bodies (copy-written; each stands
 * alone on a lock screen). Rotation happens via the schedule below — no
 * runtime logic needs to run on delivery day.
 */
export const DAILY_BODIES: readonly string[] = [
  strings.notifications.daily.fourAnswers,
  strings.notifications.daily.quietTen,
  strings.notifications.daily.fitsToday,
  strings.notifications.daily.yourMinutes,
];

/** iOS weekday numbers for weekly triggers: 1 (Sunday) through 7. */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** iOS weekday (1 = Sunday … 7 = Saturday) of the day after `now`, local time. */
export function tomorrowWeekday(now: Date): number {
  return ((now.getDay() + 1) % 7) + 1;
}

function toPermissionState(
  response: Notifications.NotificationPermissionsStatus,
): PermissionState {
  if (response.granted) return "granted";
  if (response.status === PermissionStatus.UNDETERMINED) return "undetermined";
  return "denied";
}

export const expoNotificationsPort: NotificationsPort = {
  async getPermission() {
    return toPermissionState(await Notifications.getPermissionsAsync());
  },

  async requestPermission() {
    // Default options: alert + sound + badge-free defaults are fine; no
    // provisional/ephemeral asks — the in-context rationale already ran.
    return toPermissionState(await Notifications.requestPermissionsAsync());
  },

  async scheduleDaily(slot: ReminderSlot, tomorrowBody: string) {
    // One invitation a day, full stop: replace whatever was scheduled.
    await Notifications.cancelAllScheduledNotificationsAsync();
    const { hour, minute } = SLOT_TIMES[slot];
    // Seven repeating weekly triggers, one per weekday at the same slot
    // time. Tomorrow's weekday carries the caller's streak-aware body
    // (see the port for why tomorrow, never later today); the other six
    // cycle the four generic bodies starting the day after tomorrow, so
    // any week still shows all four and no code has to run between
    // deliveries — the rotation survives the app never being opened.
    // Every reschedule (a session commit, a slot choice) replaces the
    // whole set, so tomorrow's body is fresh as long as she trains; a
    // week without either lets the weekly trigger repeat it. No title —
    // the lock screen already names the app; the body is the invitation.
    // The clock read here is the adapter's own: this is the IO layer,
    // and the port stays free of dates.
    const tomorrow = tomorrowWeekday(new Date());
    for (let offset = 0; offset < WEEKDAYS.length; offset++) {
      // Walk the week starting tomorrow: offset 0 is tomorrow's weekday,
      // 1 the day after, and so on round to later today (offset 6).
      const weekday = ((tomorrow - 1 + offset) % 7) + 1;
      // The modulo keeps the index in range; the fallback only satisfies
      // the checked-index type and can never fire.
      const body =
        offset === 0
          ? tomorrowBody
          : (DAILY_BODIES[(offset - 1) % DAILY_BODIES.length] ??
            strings.notifications.daily.fitsToday);
      await Notifications.scheduleNotificationAsync({
        content: { body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
        },
      });
    }
  },

  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};
