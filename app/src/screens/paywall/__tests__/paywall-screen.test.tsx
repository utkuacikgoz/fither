import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { WORDMARK } from "../../../design/primitives/wordmark";
import { glyph } from "../../../design/tokens";
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

// A trial start safely in the past: expired on any real clock. The
// pre-trial state uses trialStartDate null (no session ever completed),
// so neither depends on the test machine's date.
const LONG_EXPIRED_TRIAL_START = "2000-01-01";

function seedExpiredTrial() {
  useEntitlementStore.setState({ trialStartDate: LONG_EXPIRED_TRIAL_START });
}

beforeEach(async () => {
  await AsyncStorage.clear();
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
});

describe("PaywallScreen", () => {
  it("reads as the honest letter: letterhead, copy, both plans, restore, disclosure", () => {
    const screen = render(<PaywallScreen />);
    // The letterhead is the shared brand mark, not copy.
    expect(screen.getByText(WORDMARK)).toBeTruthy();
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
    // Terms/Privacy controls deliberately absent until real destinations
    // exist (audit S3): no control may render that cannot act.
    expect(screen.queryByText(strings.paywall.legal.termsLabel)).toBeNull();
    expect(screen.queryByText(strings.paywall.legal.privacyLabel)).toBeNull();
  });

  it("pre-expiry, keeps the pre-trial copy and never the expired letter", () => {
    const screen = render(<PaywallScreen />);
    expect(screen.queryByText(strings.paywall.expired.headline)).toBeNull();
    expect(screen.queryByText(strings.paywall.expired.letter)).toBeNull();
    expect(screen.queryByText(strings.paywall.expired.trialLine)).toBeNull();
    expect(screen.queryByText(strings.paywall.expired.cta)).toBeNull();
  });

  it("an expired trial swaps in the expired letter — no 'free week ahead' promise", () => {
    seedExpiredTrial();
    const screen = render(<PaywallScreen />);

    expect(screen.getByText(strings.paywall.expired.headline)).toBeTruthy();
    expect(screen.getByText(strings.paywall.expired.letter)).toBeTruthy();
    expect(screen.getByText(strings.paywall.expired.trialLine)).toBeTruthy();
    expect(screen.getByText(strings.paywall.expired.cta)).toBeTruthy();
    expect(
      screen.getByText(
        strings.paywall.expired.afterTrialNote(strings.paywall.plans.annual.price),
      ),
    ).toBeTruthy();

    // None of the pre-trial free-week copy survives into the expired state.
    expect(screen.queryByText(strings.paywall.headline)).toBeNull();
    expect(screen.queryByText(strings.paywall.letter)).toBeNull();
    expect(screen.queryByText(strings.paywall.trialLine)).toBeNull();
    expect(screen.queryByText(strings.paywall.cta)).toBeNull();
    expect(
      screen.queryByText(
        strings.paywall.afterTrialNote(strings.paywall.plans.annual.price),
      ),
    ).toBeNull();

    // Plans, restore and disclosure are shared, state-independent.
    expect(screen.getByText(strings.paywall.plans.annual.label)).toBeTruthy();
    expect(screen.getByText(strings.paywall.plans.monthly.label)).toBeTruthy();
    expect(screen.getByText(strings.paywall.restore)).toBeTruthy();
    expect(screen.getByText(strings.paywall.legal.autoRenew)).toBeTruthy();
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

  it("marks the selected plan with the check glyph, and it follows the choice", () => {
    const screen = render(<PaywallScreen />);
    expect(screen.getByTestId("paywall-plan-annual-check", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("paywall-plan-monthly-check", { includeHiddenElements: true })).toBeNull();

    fireEvent.press(screen.getByTestId("paywall-plan-monthly"));
    expect(screen.getByTestId("paywall-plan-monthly-check", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("paywall-plan-annual-check", { includeHiddenElements: true })).toBeNull();
    expect(
      screen.getByTestId("paywall-plan-monthly").props.accessibilityState.selected,
    ).toBe(true);
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
    await act(async () => {
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
    });
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
    expect(screen.queryByTestId("paywall-restore-empty")).toBeNull();
  });

  it("restore with nothing to restore says so calmly — not the error — and grants nothing", async () => {
    const screen = render(<PaywallScreen />);
    fireEvent.press(screen.getByTestId("paywall-restore"));
    await waitFor(() =>
      expect(screen.getByText(strings.paywall.restoreEmpty)).toBeTruthy(),
    );
    expect(screen.queryByText(strings.paywall.restoreError)).toBeNull();
    expect(useEntitlementStore.getState().purchase).toBeNull();
  });

  it("an actual restore failure shows the retry error, not the empty notice", async () => {
    // The dev port's failure path: the receipt store's hydration failed.
    useDevReceiptStore.setState({ hydrated: false, hydrationFailed: true });
    const screen = render(<PaywallScreen />);
    fireEvent.press(screen.getByTestId("paywall-restore"));
    await waitFor(() =>
      expect(screen.getByText(strings.paywall.restoreError)).toBeTruthy(),
    );
    expect(screen.queryByText(strings.paywall.restoreEmpty)).toBeNull();
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

  it("renders no user-facing text outside strings.ts, in either state", () => {
    const allowed = collectStringValues(strings);
    // Parameterised and dev-only values are allowed explicitly.
    allowed.add(strings.paywall.afterTrialNote(strings.paywall.plans.annual.price));
    allowed.add(strings.paywall.afterTrialNote(strings.paywall.plans.monthly.price));
    allowed.add(
      strings.paywall.expired.afterTrialNote(strings.paywall.plans.annual.price),
    );
    allowed.add(
      strings.paywall.expired.afterTrialNote(strings.paywall.plans.monthly.price),
    );
    allowed.add(DEV_RESET_LABEL); // __DEV__-only, never shipped to users
    allowed.add(WORDMARK); // the brand mark, owned by the design layer
    allowed.add(glyph.check); // the selection checkmark is a glyph token, not copy

    const preTrial = render(<PaywallScreen />);
    for (const leaf of renderedTextLeaves(preTrial.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
    preTrial.unmount();

    seedExpiredTrial();
    const expired = render(<PaywallScreen />);
    for (const leaf of renderedTextLeaves(expired.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});

it("closing the store sheet says nothing — only a process failure gets the retry line", async () => {
  const { getBilling } = jest.requireActual<typeof import("../../../monetization/billing")>(
    "../../../monetization/billing",
  );
  const spy = jest
    .spyOn(getBilling(), "purchase")
    .mockResolvedValueOnce({ ok: false, reason: "cancelled" });
  const screen = render(<PaywallScreen />);
  fireEvent.press(screen.getByTestId("paywall-purchase"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByTestId("paywall-purchase-error")).toBeNull();
  spy.mockRestore();
});
