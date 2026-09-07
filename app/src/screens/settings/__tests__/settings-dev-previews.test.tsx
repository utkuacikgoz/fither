import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { router } from "expo-router";

import { todayIso } from "../../../lib/dates";
import { useDevReceiptStore } from "../../../monetization/dev-billing";
import { entitlementStatus } from "../../../monetization/entitlement";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useSessionStore } from "../../../state/session-store";
import { DEV_PREVIEW_LABELS, SettingsScreen } from "../settings-screen";
import { resetSettingsStores } from "./settings-test-setup";

// The dev flow previewer at the foot of Settings: each action seeds REAL
// store state and goes to the real route — the guards decide what
// renders, never a faked screen.

beforeEach(async () => {
  await resetSettingsStores();
});

it("paywall (expired): seeds a lapsed store trial with nothing to restore, then goes home", () => {
  const screen = render(<SettingsScreen />);
  fireEvent.press(screen.getByTestId("settings-dev-paywall-expired"));
  const { trialStartDate, purchase, trialUsed } = useEntitlementStore.getState();
  expect(trialStartDate).not.toBeNull();
  expect(purchase).toBeNull();
  expect(trialUsed).toBe(true);
  expect(useDevReceiptStore.getState().receipt).toBeNull();
  expect(
    entitlementStatus({ firstCompletedDate: trialStartDate, purchase, trialUsed }),
  ).toBe("trialExpired");
  expect(router.replace).toHaveBeenCalledWith("/");
});

it("paywall (trial active): seeds a store trial in progress, then goes home", () => {
  const screen = render(<SettingsScreen />);
  fireEvent.press(screen.getByTestId("settings-dev-paywall-trial-active"));
  const { trialStartDate, purchase, trialUsed } = useEntitlementStore.getState();
  expect(purchase).toEqual({ plan: "annual", date: todayIso(), trial: true });
  expect(
    entitlementStatus({ firstCompletedDate: trialStartDate, purchase, trialUsed }),
  ).toBe("purchased");
  expect(router.replace).toHaveBeenCalledWith("/");
});

it("reset (fresh): clears trial, purchase AND the dev receipt, then goes home", () => {
  useEntitlementStore.setState({
    trialStartDate: "2026-08-01",
    purchase: { plan: "annual", date: "2026-08-01" },
  });
  useDevReceiptStore.setState({ receipt: { plan: "annual", date: "2026-08-01" } });
  const screen = render(<SettingsScreen />);
  fireEvent.press(screen.getByTestId("settings-dev-entitlement-fresh"));
  expect(useEntitlementStore.getState().trialStartDate).toBeNull();
  expect(useEntitlementStore.getState().purchase).toBeNull();
  expect(useDevReceiptStore.getState().receipt).toBeNull();
  expect(router.replace).toHaveBeenCalledWith("/");
});

it("preview unlock: seeds a finish summary with a real skill and pushes /unlock", () => {
  const screen = render(<SettingsScreen />);
  fireEvent.press(screen.getByTestId("settings-dev-preview-unlock"));
  const state = useSessionStore.getState();
  expect(state.finish).toMatchObject({
    completedAnything: true,
    close: { reason: "completed" },
    unlockedSkills: [{ pattern: "push", tier: 4, movementName: "Full Push-Up" }],
  });
  expect(state.finish?.unlockedSkills.length).toBeGreaterThan(0);
  expect(state.session).toBeNull();
  expect(state.player?.phase.kind).toBe("done");
  expect(router.push).toHaveBeenCalledWith("/unlock");
});

it("the finish previews carry a finished player, so the owner previews the real screen", () => {
  fireEvent.press(render(<SettingsScreen />).getByTestId("settings-dev-finish-completed"));
  const { player, session } = useSessionStore.getState();
  expect(session).toBeNull();
  expect(player?.outcomes).toEqual(["completed", "completed"]);
  expect(player?.blocks.map((b) => b.movementId)).toEqual(["wall-push-up", "knee-plank"]);
});

it.each([
  ["settings-dev-finish-completed", { reason: "completed" }],
  ["settings-dev-finish-ended-early", { reason: "endedEarly" }],
  ["settings-dev-finish-out-of-time", { reason: "outOfTime", minutes: 20 }],
])("%s seeds its close and pushes /finish", (testID, close) => {
  const screen = render(<SettingsScreen />);
  fireEvent.press(screen.getByTestId(testID));
  expect(useSessionStore.getState().finish).toMatchObject({
    completedAnything: true,
    close,
    unlockedSkills: [],
  });
  expect(router.push).toHaveBeenCalledWith("/finish");
});

it("preview finish (nothing done): seeds the zero-completion close and pushes /finish", () => {
  const screen = render(<SettingsScreen />);
  fireEvent.press(screen.getByTestId("settings-dev-finish-nothing-done"));
  expect(useSessionStore.getState().finish).toMatchObject({
    completedAnything: false,
    close: { reason: "nothingDone" },
    unlockedSkills: [],
    pointsEarned: 0,
  });
  expect(router.push).toHaveBeenCalledWith("/finish");
});

it("the crash-reporting test buttons go through the monitoring port", () => {
  const monitoring = jest.requireActual<typeof import("../../../monitoring/monitoring")>(
    "../../../monitoring/monitoring",
  );
  const port = monitoring.getMonitoring();
  const jsError = jest.spyOn(port, "testJsError").mockImplementation(() => undefined);
  const native = jest.spyOn(port, "testNativeCrash").mockImplementation(() => undefined);
  const screen = render(<SettingsScreen />);
  fireEvent.press(screen.getByText(DEV_PREVIEW_LABELS.testJsError));
  fireEvent.press(screen.getByText(DEV_PREVIEW_LABELS.testNativeCrash));
  expect(jsError).toHaveBeenCalledTimes(1);
  expect(native).toHaveBeenCalledTimes(1);
  jsError.mockRestore();
  native.mockRestore();
});
