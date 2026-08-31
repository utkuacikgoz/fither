import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { useDevReceiptStore } from "../../../monetization/dev-billing";
import { useEntitlementStore } from "../../../state/entitlement-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { DEV_RESET_LABEL, PaywallScreen } from "../paywall-screen";

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useEntitlementStore.setState({
    trialStartDate: "2026-08-01",
    purchase: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useDevReceiptStore.setState({
    receipt: null,
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("PaywallScreen", () => {
  it("reads as the honest letter: copy, both plans, restore, disclosure", () => {
    const screen = render(<PaywallScreen />);
    expect(screen.getByText(strings.paywall.headline)).toBeTruthy();
    expect(screen.getByText(strings.paywall.letter)).toBeTruthy();
    expect(screen.getByText(strings.paywall.trialLine)).toBeTruthy();
    expect(screen.getByText(strings.paywall.plans.annual.label)).toBeTruthy();
    expect(screen.getByText(strings.paywall.plans.annual.price)).toBeTruthy();
    expect(screen.getByText(strings.paywall.plans.annual.note)).toBeTruthy();
    expect(screen.getByText(strings.paywall.plans.monthly.label)).toBeTruthy();
    expect(screen.getByText(strings.paywall.plans.monthly.price)).toBeTruthy();
    expect(screen.getByText(strings.paywall.cta)).toBeTruthy();
    expect(screen.getByText(strings.paywall.restore)).toBeTruthy();
    expect(screen.getByText(strings.paywall.legal.autoRenew)).toBeTruthy();
    expect(screen.getByText(strings.paywall.legal.termsLabel)).toBeTruthy();
    expect(screen.getByText(strings.paywall.legal.privacyLabel)).toBeTruthy();
  });

  it("leads with annual: preselected, listed first, priced in the trial note", () => {
    const screen = render(<PaywallScreen />);
    expect(
      screen.getByTestId("paywall-plan-annual").props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId("paywall-plan-monthly").props.accessibilityState.selected,
    ).toBe(false);
    expect(
      screen.getByText(
        strings.paywall.afterTrialNote(strings.paywall.plans.annual.price),
      ),
    ).toBeTruthy();
  });

  it("purchases the selected plan through the port and persists the grant", async () => {
    const screen = render(<PaywallScreen />);
    fireEvent.press(screen.getByTestId("paywall-plan-monthly"));
    expect(
      screen.getByText(
        strings.paywall.afterTrialNote(strings.paywall.plans.monthly.price),
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("paywall-purchase"));
    await waitFor(() =>
      expect(useEntitlementStore.getState().purchase).toMatchObject({
        plan: "monthly",
      }),
    );

    // Simulated relaunch: the grant survives the storage round-trip
    // (capture disk, wipe memory, restore disk, rehydrate).
    await flushPersistence();
    const persisted = await AsyncStorage.getItem("fither/entitlement-v1");
    expect(persisted).toContain("monthly");
    useEntitlementStore.setState({
      purchase: null,
      trialStartDate: null,
      hydrated: false,
      hydrationFailed: false,
    });
    await flushPersistence();
    await AsyncStorage.setItem("fither/entitlement-v1", persisted ?? "");
    await useEntitlementStore.persist.rehydrate();
    await flushPersistence();
    expect(useEntitlementStore.getState().purchase).toMatchObject({
      plan: "monthly",
    });
  });

  it("restore succeeds when the (dev) store account has a receipt", async () => {
    useDevReceiptStore.setState({
      receipt: { plan: "annual", date: "2026-08-20" },
    });
    const screen = render(<PaywallScreen />);
    fireEvent.press(screen.getByTestId("paywall-restore"));
    await waitFor(() =>
      expect(useEntitlementStore.getState().purchase).toMatchObject({
        plan: "annual",
      }),
    );
    expect(screen.queryByTestId("paywall-restore-error")).toBeNull();
  });

  it("restore with nothing to restore shows the calm error and grants nothing", async () => {
    const screen = render(<PaywallScreen />);
    fireEvent.press(screen.getByTestId("paywall-restore"));
    await waitFor(() =>
      expect(screen.getByText(strings.paywall.restoreError)).toBeTruthy(),
    );
    expect(useEntitlementStore.getState().purchase).toBeNull();
  });

  it("the dev-only control resets the app-side entitlement", async () => {
    const screen = render(<PaywallScreen />);
    fireEvent.press(screen.getByTestId("paywall-purchase"));
    await waitFor(() =>
      expect(useEntitlementStore.getState().purchase).not.toBeNull(),
    );

    fireEvent.press(screen.getByTestId("paywall-dev-reset"));
    expect(useEntitlementStore.getState().purchase).toBeNull();
    expect(useEntitlementStore.getState().trialStartDate).toBeNull();
  });

  it("renders no user-facing text outside strings.ts", () => {
    const allowed = collectStringValues(strings);
    // Parameterised and dev-only values are allowed explicitly.
    allowed.add(strings.paywall.afterTrialNote(strings.paywall.plans.annual.price));
    allowed.add(strings.paywall.afterTrialNote(strings.paywall.plans.monthly.price));
    allowed.add(DEV_RESET_LABEL); // __DEV__-only, never shipped to users

    const screen = render(<PaywallScreen />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
