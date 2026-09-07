import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import * as Notifications from "expo-notifications";

import { strings } from "../../../copy/strings";
import { glyph } from "../../../design/tokens";
import { useReminderStore } from "../../../state/reminder-store";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { InvitationPage } from "../pages/invitation-page";
import { permissionResponse, resetSettingsStores } from "./settings-test-setup";

beforeEach(async () => {
  await resetSettingsStores();
});

function selected(screen: ReturnType<typeof render>, testID: string): boolean {
  const state = screen.getByTestId(testID).props.accessibilityState as { selected: boolean };
  return state.selected;
}

describe("Settings → Daily invitation", () => {
  it("shows the three real hours plus 'No invitation', current state selected", () => {
    const screen = render(<InvitationPage />);
    expect(screen.getByText(strings.settings.reminders.title)).toBeTruthy();
    expect(screen.getByText(strings.notifications.rationale.line)).toBeTruthy();
    expect(screen.getByText(strings.notifications.time.morning)).toBeTruthy();
    expect(screen.getByText(strings.notifications.time.midday)).toBeTruthy();
    expect(screen.getByText(strings.notifications.time.evening)).toBeTruthy();
    expect(screen.getByText(strings.settings.reminders.off)).toBeTruthy();
    // No slot chosen: "No invitation" is the honest selected state.
    expect(selected(screen, "reminder-off")).toBe(true);
    expect(selected(screen, "reminder-morning")).toBe(false);
  });

  it("shows the scheduled slot as selected, with a visible check", () => {
    useReminderStore.setState({ slot: "evening", asked: true });
    const screen = render(<InvitationPage />);
    expect(selected(screen, "reminder-evening")).toBe(true);
    expect(selected(screen, "reminder-off")).toBe(false);
    expect(screen.getByTestId("reminder-evening-check", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("reminder-off-check", { includeHiddenElements: true })).toBeNull();
  });

  it("picking a slot with permission never granted requests it then, in context", async () => {
    const screen = render(<InvitationPage />);
    fireEvent.press(screen.getByTestId("reminder-midday"));
    await waitFor(() => expect(useReminderStore.getState().slot).toBe("midday"));
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    // Scheduled for real through the port's adapter (one per weekday).
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(7);
    expect(selected(screen, "reminder-midday")).toBe(true);
    expect(selected(screen, "reminder-off")).toBe(false);
  });

  it("changing the slot reschedules at the new hour", async () => {
    useReminderStore.setState({ slot: "morning", asked: true });
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permissionResponse("granted"));
    const screen = render(<InvitationPage />);
    fireEvent.press(screen.getByTestId("reminder-evening"));
    await waitFor(() => expect(useReminderStore.getState().slot).toBe("evening"));
    // Already granted: no OS dialog, straight to the reschedule.
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    // Replace-not-stack: the old schedule is cancelled first.
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    const triggers = jest
      .mocked(Notifications.scheduleNotificationAsync)
      .mock.calls.map(([request]) => request.trigger);
    for (const trigger of triggers) {
      expect(trigger).toMatchObject({ hour: 18, minute: 30 });
    }
  });

  it("after a hard OS denial, the page says where the switch is — under the rows — and only then", async () => {
    const denied = permissionResponse("denied");
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(denied);

    const screen = render(<InvitationPage />);
    expect(screen.queryByTestId("reminder-denied")).toBeNull();
    fireEvent.press(screen.getByTestId("reminder-morning"));
    await waitFor(() => expect(screen.getByText(strings.settings.reminders.denied)).toBeTruthy());
    // Mapping: the line lives in the group whose rows it explains.
    expect(
      screen.getByTestId("settings-reminders").findByProps({ testID: "reminder-denied" }),
    ).toBeTruthy();
    // Nothing scheduled; "No invitation" honestly stays selected.
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(useReminderStore.getState().slot).toBeNull();
    expect(selected(screen, "reminder-off")).toBe(true);

    // "No invitation" answers the page; the line has nothing left to say.
    fireEvent.press(screen.getByTestId("reminder-off"));
    await waitFor(() => expect(screen.queryByTestId("reminder-denied")).toBeNull());
  });

  it("'No invitation' cancels the schedule and clears the slot", async () => {
    useReminderStore.setState({ slot: "midday", asked: true });
    const screen = render(<InvitationPage />);
    fireEvent.press(screen.getByTestId("reminder-off"));
    await waitFor(() => expect(useReminderStore.getState().slot).toBeNull());
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(selected(screen, "reminder-off")).toBe(true);
  });

  it("renders no user-facing text outside strings.ts", async () => {
    const denied = permissionResponse("denied");
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(denied);
    const allowed = collectStringValues(strings);
    allowed.add(glyph.check);
    const screen = render(<InvitationPage />);
    fireEvent.press(screen.getByTestId("reminder-morning"));
    await waitFor(() => expect(screen.getByTestId("reminder-denied")).toBeTruthy());
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
