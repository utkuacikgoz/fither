import * as Notifications from "expo-notifications";

import { strings } from "../../copy/strings";
import {
  DAILY_BODIES,
  expoNotificationsPort,
  tomorrowWeekday,
} from "../expo-notifications";
import { SLOT_TIMES } from "../notifications";

// The adapter against the (jest-setup) SDK mock: what reaches
// expo-notifications when the port is driven. Everything here is local
// scheduling — no network exists to mock.

const scheduleAsync = jest.mocked(Notifications.scheduleNotificationAsync);
const cancelAsync = jest.mocked(
  Notifications.cancelAllScheduledNotificationsAsync,
);

/** A generic body, as the callers pass when no run is alive. */
const GENERIC = strings.notifications.daily.fitsToday;
/** A streak body, as the callers pass when a run is alive. */
const STREAK = strings.streak.notification.nextDay(3);

function bodyFor(weekday: number): string | undefined {
  const request = scheduleAsync.mock.calls
    .map(([r]) => r)
    .find(
      (r) => (r.trigger as Notifications.WeeklyTriggerInput).weekday === weekday,
    );
  return request?.content.body ?? undefined;
}

afterEach(() => {
  jest.useRealTimers();
});

function permissionResponse(
  status: "undetermined" | "granted" | "denied",
): Notifications.NotificationPermissionsStatus {
  return {
    status,
    granted: status === "granted",
    canAskAgain: status !== "denied",
    expires: "never",
  } as unknown as Notifications.NotificationPermissionsStatus;
}

describe("scheduleDaily", () => {
  it("schedules one repeating weekly invitation per weekday at the slot's hour", async () => {
    await expoNotificationsPort.scheduleDaily("morning", GENERIC);
    expect(scheduleAsync).toHaveBeenCalledTimes(7);
    const requests = scheduleAsync.mock.calls.map(([request]) => request);
    const weekdays = requests.map(
      (request) => (request.trigger as Notifications.WeeklyTriggerInput).weekday,
    );
    expect([...weekdays].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const request of requests) {
      expect(request.trigger).toMatchObject({
        type: "weekly",
        hour: SLOT_TIMES.morning.hour,
        minute: SLOT_TIMES.morning.minute,
      });
    }
  });

  it("replaces any previous schedule — cancel runs before the first schedule", async () => {
    await expoNotificationsPort.scheduleDaily("midday", GENERIC);
    expect(cancelAsync).toHaveBeenCalledTimes(1);
    const firstCancel =
      cancelAsync.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER;
    const firstSchedule = scheduleAsync.mock.invocationCallOrder[0] ?? 0;
    expect(firstCancel).toBeLessThan(firstSchedule);
    for (const [request] of scheduleAsync.mock.calls) {
      expect(request.trigger).toMatchObject({ hour: 12, minute: 30 });
    }
  });

  it("evening arrives at 18:30 — the hour the label promises", async () => {
    await expoNotificationsPort.scheduleDaily("evening", GENERIC);
    for (const [request] of scheduleAsync.mock.calls) {
      expect(request.trigger).toMatchObject({ hour: 18, minute: 30 });
    }
  });

  it("rotates the four copy-written bodies across the week, no title, all four used", async () => {
    await expoNotificationsPort.scheduleDaily("morning", GENERIC);
    const bodies = scheduleAsync.mock.calls.map(
      ([request]) => request.content.body,
    );
    const allowed = Object.values(strings.notifications.daily);
    for (const body of bodies) {
      expect(allowed).toContain(body);
    }
    expect(new Set(bodies).size).toBe(4);
    for (const [request] of scheduleAsync.mock.calls) {
      expect(request.content.title).toBeUndefined();
    }
    // DAILY_BODIES is exactly the copy surface, nothing invented.
    expect([...DAILY_BODIES].sort()).toEqual([...allowed].sort());
  });

  describe("the streak body (ADR-0018) sits on tomorrow's firing only", () => {
    // 2026-09-07 is a Monday: iOS weekday 2; tomorrow is Tuesday, 3.
    const monday = new Date(2026, 8, 7, 10, 0, 0);

    it("tomorrowWeekday walks the iOS numbering, Saturday wrapping to Sunday", () => {
      expect(tomorrowWeekday(monday)).toBe(3);
      expect(tomorrowWeekday(new Date(2026, 8, 12, 10))).toBe(1); // Saturday → Sunday
      expect(tomorrowWeekday(new Date(2026, 8, 13, 10))).toBe(2); // Sunday → Monday
    });

    it("tomorrow carries the caller's body; every other day is generic", async () => {
      jest.useFakeTimers({ now: monday });
      await expoNotificationsPort.scheduleDaily("morning", STREAK);
      expect(scheduleAsync).toHaveBeenCalledTimes(7);
      expect(bodyFor(3)).toBe(STREAK);
      for (const weekday of [1, 2, 4, 5, 6, 7]) {
        expect(DAILY_BODIES).toContain(bodyFor(weekday));
      }
      // Later today (Monday, 8:00 already passed or not) is never the
      // streak body: it speaks from the day after today.
      expect(bodyFor(2)).not.toBe(STREAK);
    });

    it("the six generic days still show all four bodies in any week", async () => {
      jest.useFakeTimers({ now: monday });
      await expoNotificationsPort.scheduleDaily("evening", STREAK);
      const generic = [1, 2, 4, 5, 6, 7].map((weekday) => bodyFor(weekday));
      expect(new Set(generic).size).toBe(4);
    });

    it("still one firing per weekday, same slot time, cancel-first", async () => {
      jest.useFakeTimers({ now: monday });
      await expoNotificationsPort.scheduleDaily("midday", STREAK);
      const weekdays = scheduleAsync.mock.calls.map(
        ([r]) => (r.trigger as Notifications.WeeklyTriggerInput).weekday,
      );
      expect([...weekdays].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(cancelAsync).toHaveBeenCalledTimes(1);
      const firstCancel =
        cancelAsync.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER;
      const firstSchedule = scheduleAsync.mock.invocationCallOrder[0] ?? 0;
      expect(firstCancel).toBeLessThan(firstSchedule);
    });
  });
});

describe("cancelAll", () => {
  it("cancels every scheduled invitation", async () => {
    await expoNotificationsPort.cancelAll();
    expect(cancelAsync).toHaveBeenCalledTimes(1);
  });
});

describe("permission mapping", () => {
  it("maps the OS response into the port's three states", async () => {
    const getAsync = jest.mocked(Notifications.getPermissionsAsync);
    getAsync.mockResolvedValue(permissionResponse("undetermined"));
    await expect(expoNotificationsPort.getPermission()).resolves.toBe(
      "undetermined",
    );
    getAsync.mockResolvedValue(permissionResponse("granted"));
    await expect(expoNotificationsPort.getPermission()).resolves.toBe(
      "granted",
    );
    getAsync.mockResolvedValue(permissionResponse("denied"));
    await expect(expoNotificationsPort.getPermission()).resolves.toBe("denied");
  });

  it("requestPermission maps the dialog's answer the same way", async () => {
    const requestAsync = jest.mocked(Notifications.requestPermissionsAsync);
    requestAsync.mockResolvedValue(permissionResponse("granted"));
    await expect(expoNotificationsPort.requestPermission()).resolves.toBe(
      "granted",
    );
    requestAsync.mockResolvedValue(permissionResponse("denied"));
    await expect(expoNotificationsPort.requestPermission()).resolves.toBe(
      "denied",
    );
  });
});
