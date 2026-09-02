import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import {
  getNotifications,
  type NotificationsPort,
} from "../../../notifications/notifications";
import { useReminderStore } from "../../../state/reminder-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { ReminderAskScreen } from "../reminder-ask-screen";

// Port-mocked (the port pattern): the screen and store are exercised for
// real; only the OS surface is a fake.
jest.mock("../../../notifications/notifications", () => {
  const actual = jest.requireActual("../../../notifications/notifications");
  const port = {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    scheduleDaily: jest.fn(),
    cancelAll: jest.fn(),
  };
  return { ...actual, getNotifications: () => port };
});

const port = getNotifications() as jest.Mocked<NotificationsPort>;

beforeEach(() => {
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

describe("ReminderAskScreen", () => {
  it("opens on the rationale — one line, allow and a peer decline", () => {
    const screen = render(<ReminderAskScreen onDone={jest.fn()} />);
    expect(screen.getByText(strings.notifications.rationale.line)).toBeTruthy();
    expect(screen.getByText(strings.notifications.rationale.allow)).toBeTruthy();
    expect(
      screen.getByText(strings.notifications.rationale.decline),
    ).toBeTruthy();
    // The time question waits for an actual grant.
    expect(screen.queryByText(strings.notifications.time.question)).toBeNull();
    // Nothing OS-facing happens before she answers.
    expect(port.requestPermission).not.toHaveBeenCalled();
  });

  it("'Not now' ends it: asked forever, no OS dialog, no schedule", () => {
    const onDone = jest.fn();
    const screen = render(<ReminderAskScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId("reminder-ask-decline"));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(useReminderStore.getState().asked).toBe(true);
    expect(port.requestPermission).not.toHaveBeenCalled();
    expect(port.scheduleDaily).not.toHaveBeenCalled();
  });

  it("allow → OS grant → the time question with the three real hours", async () => {
    const screen = render(<ReminderAskScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId("reminder-ask-allow"));
    expect(
      await screen.findByText(strings.notifications.time.question),
    ).toBeTruthy();
    expect(screen.getByText(strings.notifications.time.morning)).toBeTruthy();
    expect(screen.getByText(strings.notifications.time.midday)).toBeTruthy();
    expect(screen.getByText(strings.notifications.time.evening)).toBeTruthy();
    // The rationale step is gone — one decision per screen state.
    expect(screen.queryByText(strings.notifications.rationale.allow)).toBeNull();
  });

  it("picking a slot schedules that slot and leaves", async () => {
    const onDone = jest.fn();
    const screen = render(<ReminderAskScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId("reminder-ask-allow"));
    fireEvent.press(await screen.findByTestId("reminder-ask-midday"));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(port.scheduleDaily).toHaveBeenCalledWith("midday");
    expect(useReminderStore.getState().slot).toBe("midday");
    expect(useReminderStore.getState().asked).toBe(true);
  });

  it("an OS decline leaves quietly: asked forever, never the time question", async () => {
    port.requestPermission.mockResolvedValue("denied");
    const onDone = jest.fn();
    const screen = render(<ReminderAskScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId("reminder-ask-allow"));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(useReminderStore.getState().asked).toBe(true);
    expect(screen.queryByText(strings.notifications.time.question)).toBeNull();
    expect(port.scheduleDaily).not.toHaveBeenCalled();
  });

  it("renders no user-facing text outside strings.ts, both steps", async () => {
    const allowed = collectStringValues(strings);
    const screen = render(<ReminderAskScreen onDone={jest.fn()} />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
    fireEvent.press(screen.getByTestId("reminder-ask-allow"));
    await screen.findByText(strings.notifications.time.question);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
