import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Linking } from "react-native";

import { clearRecordedEvents, recordedEvents } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { WORDMARK } from "../../../design/primitives/wordmark";
import { glyph } from "../../../design/tokens";
import { LEGAL_URLS } from "../../../lib/legal-links";
import { useDevReceiptStore } from "../../../monetization/dev-billing";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useIntentionStore } from "../../../state/intention-store";
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
  // ADR-0014 §6: a lapsed store trial — held once, nothing active now.
  useEntitlementStore.setState({ trialStartDate: LONG_EXPIRED_TRIAL_START, purchase: null, trialUsed: true });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useEntitlementStore.setState({
    trialStartDate: null,
    purchase: null,
    trialUsed: false,
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
  it("connects the optional offer to her weekly choice and records a quiet exit", () => {
    clearRecordedEvents();
    useIntentionStore.setState({ target: 3, asked: true });
    const onLeave = jest.fn();
    const screen = render(<PaywallScreen firstClose onLeave={onLeave} />);
    expect(screen.getByText(strings.paywall.firstClose.lead(3))).toBeTruthy();
    fireEvent.press(screen.getByTestId("paywall-not-now"));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(recordedEvents()).toContainEqual({ name: "paywall_leave", properties: { surface: "firstClose" } });
  });
  it("reads as the honest letter: letterhead, copy, both plans, restore, disclosure", () => {
    const screen = render(<PaywallScreen />);
    // The letterhead is the shared brand mark, not copy.
    expect(screen.getByText(WORDMARK)).toBeTruthy();
    expect(screen.getByText(strings.paywall.headline)).toBeTruthy();
    expect(screen.getByText(strings.paywall.lead)).toBeTruthy();
    // The ladder she is on, drawn: six tiers, the reached ones filled.
    expect(screen.getByTestId("paywall-ladder")).toBeTruthy();
    for (const line of Object.values(strings.paywall.benefits)) {
      expect(screen.getByText(line)).toBeTruthy();
    }
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

  it("opens the first-party terms and privacy pages", () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const screen = render(<PaywallScreen />);
    fireEvent.press(screen.getByTestId("paywall-terms"));
    fireEvent.press(screen.getByTestId("paywall-privacy"));
    expect(open).toHaveBeenNthCalledWith(1, LEGAL_URLS.terms);
    expect(open).toHaveBeenNthCalledWith(2, LEGAL_URLS.privacy);
  });

  it("pre-expiry, keeps the pre-trial copy and never the expired letter", () => {
    const screen = render(<PaywallScreen />);
    expect(screen.queryByText(strings.paywall.expired.headline)).toBeNull();
    expect(screen.queryByText(strings.paywall.expired.recordNote)).toBeNull();
    expect(screen.queryByText(strings.paywall.expired.trialLine)).toBeNull();
    expect(screen.queryByText(strings.paywall.expired.cta)).toBeNull();
  });

  it("an expired trial swaps in the expired letter — no 'free week ahead' promise", () => {
    seedExpiredTrial();
    const screen = render(<PaywallScreen />);

    expect(screen.getByText(strings.paywall.expired.headline)).toBeTruthy();
    expect(screen.getByText(strings.paywall.expired.recordNote)).toBeTruthy();
    expect(screen.getByText(strings.paywall.expired.trialLine)).toBeTruthy();
    expect(screen.getByText(strings.paywall.expired.cta)).toBeTruthy();

    // None of the pre-trial free-week copy survives into the expired state.
    expect(screen.queryByText(strings.paywall.headline)).toBeNull();
    expect(screen.queryByText(strings.paywall.lead)).toBeNull();
    expect(screen.queryByText(strings.paywall.trialLine)).toBeNull();
    expect(screen.queryByText(strings.paywall.cta)).toBeNull();

    // Plans, restore and disclosure are shared, state-independent.
    expect(screen.getByText(strings.paywall.plans.annual.label)).toBeTruthy();
    expect(screen.getByText(strings.paywall.plans.monthly.label)).toBeTruthy();
    expect(screen.getByText(strings.paywall.restore)).toBeTruthy();
    expect(screen.getByText(strings.paywall.legal.autoRenew)).toBeTruthy();
  });

  it("leads with annual: preselected and listed first", () => {
    const screen = render(<PaywallScreen />);
    expect(
      screen.getByTestId("paywall-plan-annual").props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId("paywall-plan-monthly").props.accessibilityState.selected,
    ).toBe(false);
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
  // Let the attempt settle inside act(): busy clears once the port answers.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(spy).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("paywall-purchase-error")).toBeNull();
  spy.mockRestore();
});

describe("paywall_view (ADR-0024)", () => {
  beforeEach(() => clearRecordedEvents());

  it("reports the gated day once, naming the surface and nothing else", () => {
    render(<PaywallScreen inDay />);
    expect(recordedEvents()).toEqual([
      { name: "paywall_view", properties: { surface: "gate" } },
    ]);
  });

  it("reports the settings surface when shown outside the day", () => {
    render(<PaywallScreen />);
    expect(recordedEvents().map((e) => e.properties)).toEqual([{ surface: "settings" }]);
  });
});

describe("paywall_plan (drop-off pass)", () => {
  beforeEach(() => clearRecordedEvents());

  it("reports each plan row she taps, and nothing on the default selection", () => {
    const screen = render(<PaywallScreen />);
    expect(recordedEvents().filter((e) => e.name === "paywall_plan")).toEqual([]);
    fireEvent.press(screen.getByTestId("paywall-plan-monthly"));
    fireEvent.press(screen.getByTestId("paywall-plan-annual"));
    expect(recordedEvents().filter((e) => e.name === "paywall_plan")).toEqual([
      { name: "paywall_plan", properties: { plan: "monthly" } },
      { name: "paywall_plan", properties: { plan: "annual" } },
    ]);
  });
});
