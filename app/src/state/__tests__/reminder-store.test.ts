import AsyncStorage from "@react-native-async-storage/async-storage";

import { strings } from "../../copy/strings";
import {
  getNotifications,
  REMINDER_SLOTS,
  SLOT_TIMES,
  type NotificationsPort,
} from "../../notifications/notifications";
import { reminderAskDue, useReminderStore } from "../reminder-store";

// The store is tested against a MOCKED port (the port pattern's whole
// point): no SDK, no native module — just the contract between state
// and the notification surface.
jest.mock("../../notifications/notifications", () => {
  const actual = jest.requireActual("../../notifications/notifications");
  const port = {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    scheduleDaily: jest.fn(),
    cancelAll: jest.fn(),
  };
  return { ...actual, getNotifications: () => port };
});

const port = getNotifications() as jest.Mocked<NotificationsPort>;

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  port.getPermission.mockResolvedValue("undetermined");
  port.requestPermission.mockResolvedValue("granted");
  port.scheduleDaily.mockResolvedValue(undefined);
  port.cancelAll.mockResolvedValue(undefined);
  useReminderStore.setState({
    asked: false,
    slot: null,
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("reminder store", () => {
  it("decline marks asked forever and touches no OS surface", async () => {
    useReminderStore.getState().decline();
    expect(useReminderStore.getState().asked).toBe(true);
    expect(useReminderStore.getState().slot).toBeNull();
    expect(port.requestPermission).not.toHaveBeenCalled();
    expect(port.scheduleDaily).not.toHaveBeenCalled();

    // Persisted — the once-ever guard survives relaunch.
    await flushPersistence();
    expect(await AsyncStorage.getItem("fither/reminders-v1")).toContain(
      '"asked":true',
    );
  });

  it("allow marks asked, requests the OS permission, and reports the grant", async () => {
    await expect(useReminderStore.getState().allow()).resolves.toBe(true);
    expect(useReminderStore.getState().asked).toBe(true);
    expect(port.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("an OS decline at allow is final too: asked stays true, nothing scheduled", async () => {
    port.requestPermission.mockResolvedValue("denied");
    await expect(useReminderStore.getState().allow()).resolves.toBe(false);
    expect(useReminderStore.getState().asked).toBe(true);
    expect(port.scheduleDaily).not.toHaveBeenCalled();
  });

  it("a native failure during allow reads as not granted, never a crash", async () => {
    port.requestPermission.mockRejectedValue(new Error("native down"));
    await expect(useReminderStore.getState().allow()).resolves.toBe(false);
    expect(useReminderStore.getState().asked).toBe(true);
  });

  it("chooseSlot schedules through the port and persists the slot", async () => {
    await expect(useReminderStore.getState().chooseSlot("midday")).resolves.toBe(
      true,
    );
    expect(port.scheduleDaily).toHaveBeenCalledWith("midday");
    expect(useReminderStore.getState().slot).toBe("midday");
    await flushPersistence();
    expect(await AsyncStorage.getItem("fither/reminders-v1")).toContain(
      '"slot":"midday"',
    );
  });

  it("a failed schedule records nothing — Settings can retry any day", async () => {
    port.scheduleDaily.mockRejectedValue(new Error("native down"));
    await expect(
      useReminderStore.getState().chooseSlot("morning"),
    ).resolves.toBe(false);
    expect(useReminderStore.getState().slot).toBeNull();
  });

  it("the Settings path requests permission in context when never granted", async () => {
    await expect(
      useReminderStore.getState().chooseSlotWithPermission("evening"),
    ).resolves.toBe(true);
    expect(port.getPermission).toHaveBeenCalledTimes(1);
    expect(port.requestPermission).toHaveBeenCalledTimes(1);
    expect(port.scheduleDaily).toHaveBeenCalledWith("evening");
    expect(useReminderStore.getState().slot).toBe("evening");
    // Engaging the section herself also ends the in-context ask forever.
    expect(useReminderStore.getState().asked).toBe(true);
  });

  it("the Settings path skips the dialog when permission is already granted", async () => {
    port.getPermission.mockResolvedValue("granted");
    await useReminderStore.getState().chooseSlotWithPermission("morning");
    expect(port.requestPermission).not.toHaveBeenCalled();
    expect(port.scheduleDaily).toHaveBeenCalledWith("morning");
  });

  it("an OS denial on the Settings path schedules nothing, honestly", async () => {
    port.requestPermission.mockResolvedValue("denied");
    await expect(
      useReminderStore.getState().chooseSlotWithPermission("morning"),
    ).resolves.toBe(false);
    expect(port.scheduleDaily).not.toHaveBeenCalled();
    expect(useReminderStore.getState().slot).toBeNull();
    expect(useReminderStore.getState().asked).toBe(true);
  });

  it("disable clears the slot immediately and cancels the schedule", async () => {
    useReminderStore.setState({ slot: "morning" });
    await useReminderStore.getState().disable();
    expect(useReminderStore.getState().slot).toBeNull();
    expect(port.cancelAll).toHaveBeenCalledTimes(1);
  });

  it("reminderAskDue fails safe: unhydrated says no, asked says no", () => {
    useReminderStore.setState({ hydrated: false, asked: false });
    expect(reminderAskDue()).toBe(false);
    useReminderStore.setState({ hydrated: true, asked: true });
    expect(reminderAskDue()).toBe(false);
    useReminderStore.setState({ hydrated: true, asked: false });
    expect(reminderAskDue()).toBe(true);
  });
});

describe("slot times are the facts the copy states", () => {
  it("every slot label names its real scheduled hour", () => {
    for (const slot of REMINDER_SLOTS) {
      const { hour, minute } = SLOT_TIMES[slot];
      const stated = `${hour}:${String(minute).padStart(2, "0")}`;
      expect(strings.notifications.time[slot]).toContain(`(${stated})`);
    }
  });

  it("the decided hours: 8:00, 12:30, 18:30", () => {
    expect(SLOT_TIMES).toEqual({
      morning: { hour: 8, minute: 0 },
      midday: { hour: 12, minute: 30 },
      evening: { hour: 18, minute: 30 },
    });
  });
});

describe("a hard OS denial in Settings", () => {
  it("is remembered only until a grant or 'No invitation' answers the section", async () => {
    // The port answers "denied" on both reads: the dialog no longer
    // appears, so the request comes straight back denied too.
    port.getPermission.mockResolvedValue("denied");
    port.requestPermission.mockResolvedValue("denied");

    // An earlier slot was scheduled while permission was granted.
    useReminderStore.setState({ slot: "evening" });
    const store = useReminderStore.getState();
    expect(store.permissionDenied).toBe(false);
    await store.chooseSlotWithPermission("morning");
    expect(useReminderStore.getState().permissionDenied).toBe(true);
    // The OS will deliver nothing now: the old slot is not "selected".
    expect(useReminderStore.getState().slot).toBeNull();

    // "No invitation" answers the section: the line has nothing to explain.
    await useReminderStore.getState().disable();
    expect(useReminderStore.getState().permissionDenied).toBe(false);
  });

  it("never persists — the OS is the truth on every launch", () => {
    // The persist partialize names asked and slot only; a stale "denied"
    // after she flips the switch in iOS Settings would be a lie.
    const persisted = (useReminderStore.persist.getOptions().partialize as (
      s: ReturnType<typeof useReminderStore.getState>,
    ) => object)({ ...useReminderStore.getState(), permissionDenied: true });
    expect(persisted).not.toHaveProperty("permissionDenied");
  });
});
