import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { useDevReceiptStore } from "../../../monetization/dev-billing";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useFirstMovementStore } from "../../../state/first-movement-store";
import { useSettingsStore } from "../../../state/settings-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { DEV_TIMING_TITLE } from "../../dev-timing/first-movement-readout";
import { DEV_ENTITLEMENT_RESET_LABEL, SettingsScreen } from "../settings-screen";

// Deterministic version for the footer line, regardless of what the test
// environment's expo-constants mock carries.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.2.3" } },
}));

const VERSION_LINE = strings.settings.version("1.2.3");

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettingsStore.setState({
    alwaysAvoid: [],
    hydrated: true,
    hydrationFailed: false,
  });
  useEntitlementStore.setState({
    trialStartDate: null,
    purchase: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useDevReceiptStore.setState({
    receipt: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useFirstMovementStore.setState({
    runs: [],
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("SettingsScreen", () => {
  it("renders every section in order: avoid, subscription, dev tools, version", () => {
    const screen = render(<SettingsScreen />);
    expect(screen.getByText(strings.settings.title)).toBeTruthy();
    expect(screen.getByText(strings.settings.avoid.title)).toBeTruthy();
    expect(screen.getByText(strings.settings.avoid.body)).toBeTruthy();
    for (const label of Object.values(strings.prompt.soreness.areas)) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(strings.settings.restore.title)).toBeTruthy();
    expect(screen.getByText(strings.paywall.restore)).toBeTruthy();
    expect(screen.getByText(strings.settings.dev.title)).toBeTruthy();
    expect(screen.getByText(VERSION_LINE)).toBeTruthy();

    // Order as specified: each section heading above the next.
    const leaves = renderedTextLeaves(screen.toJSON());
    const order = [
      strings.settings.avoid.title,
      strings.settings.restore.title,
      strings.settings.dev.title,
      VERSION_LINE,
    ].map((text) => leaves.indexOf(text));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("toggling an avoid area shows the check and persists to the settings store", async () => {
    const screen = render(<SettingsScreen />);

    expect(screen.queryByTestId("avoid-knees-check")).toBeNull();
    fireEvent.press(screen.getByTestId("avoid-knees"));
    expect(screen.getByTestId("avoid-knees-check")).toBeTruthy();
    expect(useSettingsStore.getState().alwaysAvoid).toEqual(["knees"]);

    // Persisted immediately via the store layer (offline-safe disk write).
    await flushPersistence();
    const persisted = await AsyncStorage.getItem("fither/settings-v1");
    expect(persisted).toContain("knees");

    // Toggling off removes it — from the screen, the store and disk.
    fireEvent.press(screen.getByTestId("avoid-knees"));
    expect(screen.queryByTestId("avoid-knees-check")).toBeNull();
    expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
    await flushPersistence();
    const cleared = await AsyncStorage.getItem("fither/settings-v1");
    expect(cleared).not.toContain("knees");
  });

  it("shows areas already on the persistent list as selected", () => {
    useSettingsStore.setState({ alwaysAvoid: ["wrists", "back"] });
    const screen = render(<SettingsScreen />);
    expect(screen.getByTestId("avoid-wrists-check")).toBeTruthy();
    expect(screen.getByTestId("avoid-back-check")).toBeTruthy();
    expect(screen.queryByTestId("avoid-knees-check")).toBeNull();
  });

  it("restore succeeds when the (dev) store account has a receipt — no notice", async () => {
    useDevReceiptStore.setState({
      receipt: { plan: "annual", date: "2026-08-20" },
    });
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() =>
      expect(useEntitlementStore.getState().purchase).toMatchObject({
        plan: "annual",
      }),
    );
    expect(screen.queryByTestId("settings-restore-error")).toBeNull();
    expect(screen.queryByTestId("settings-restore-empty")).toBeNull();
  });

  it("restore with nothing to restore says so calmly — not the error — and grants nothing", async () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() =>
      expect(screen.getByText(strings.paywall.restoreEmpty)).toBeTruthy(),
    );
    expect(screen.queryByText(strings.paywall.restoreError)).toBeNull();
    expect(useEntitlementStore.getState().purchase).toBeNull();
  });

  it("an actual restore failure shows the retry error, not the empty notice", async () => {
    // The dev port's failure path: the receipt store's hydration failed.
    useDevReceiptStore.setState({ hydrated: false, hydrationFailed: true });
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() =>
      expect(screen.getByText(strings.paywall.restoreError)).toBeTruthy(),
    );
    expect(screen.queryByText(strings.paywall.restoreEmpty)).toBeNull();
    expect(useEntitlementStore.getState().purchase).toBeNull();
  });

  it("dev tools: opens the timing readout as an overlay and comes back", () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-timing"));
    // The readout replaces the screen wholesale (its title also names the
    // settings link, so presence is asserted structurally).
    expect(screen.getByTestId("dev-timing-close")).toBeTruthy();
    expect(screen.queryByText(strings.settings.title)).toBeNull();

    fireEvent.press(screen.getByTestId("dev-timing-close"));
    expect(screen.queryByTestId("dev-timing-close")).toBeNull();
    expect(screen.getByText(strings.settings.title)).toBeTruthy();
  });

  it("dev tools: resets the app-side entitlement", () => {
    useEntitlementStore.setState({
      trialStartDate: "2026-08-01",
      purchase: { plan: "annual", date: "2026-08-01" },
    });
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-reset"));
    expect(useEntitlementStore.getState().purchase).toBeNull();
    expect(useEntitlementStore.getState().trialStartDate).toBeNull();
  });

  it("renders no dev section at all in the release shape", () => {
    // Jest runs with __DEV__ true; the prop covers the release value.
    const screen = render(<SettingsScreen devToolsEnabled={false} />);
    expect(screen.queryByText(strings.settings.dev.title)).toBeNull();
    expect(screen.queryByTestId("settings-dev-timing")).toBeNull();
    expect(screen.queryByTestId("settings-dev-reset")).toBeNull();
    // The user-facing sections are untouched by the flag.
    expect(screen.getByText(strings.settings.avoid.title)).toBeTruthy();
    expect(screen.getByText(strings.settings.restore.title)).toBeTruthy();
    expect(screen.getByText(VERSION_LINE)).toBeTruthy();
  });

  it("renders no user-facing text outside strings.ts", async () => {
    const allowed = collectStringValues(strings);
    // Parameterised and dev-only values are allowed explicitly.
    allowed.add(VERSION_LINE);
    allowed.add(DEV_TIMING_TITLE); // __DEV__-only, never shipped to users
    allowed.add(DEV_ENTITLEMENT_RESET_LABEL); // __DEV__-only

    const screen = render(<SettingsScreen />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }

    // The restore notices are strings.ts copy too.
    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() =>
      expect(screen.getByText(strings.paywall.restoreEmpty)).toBeTruthy(),
    );
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
