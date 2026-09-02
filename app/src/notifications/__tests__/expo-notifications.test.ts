import * as Notifications from "expo-notifications";

import { strings } from "../../copy/strings";
import { DAILY_BODIES, expoNotificationsPort } from "../expo-notifications";
import { SLOT_TIMES } from "../notifications";

// The adapter against the (jest-setup) SDK mock: what reaches
// expo-notifications when the port is driven. Everything here is local
// scheduling — no network exists to mock.

const scheduleAsync = jest.mocked(Notifications.scheduleNotificationAsync);
const cancelAsync = jest.mocked(
  Notifications.cancelAllScheduledNotificationsAsync,
);

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
    await expoNotificationsPort.scheduleDaily("morning");
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
    await expoNotificationsPort.scheduleDaily("midday");
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
    await expoNotificationsPort.scheduleDaily("evening");
    for (const [request] of scheduleAsync.mock.calls) {
      expect(request.trigger).toMatchObject({ hour: 18, minute: 30 });
    }
  });

  it("rotates the four copy-written bodies across the week, no title, all four used", async () => {
    await expoNotificationsPort.scheduleDaily("morning");
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
