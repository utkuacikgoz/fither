import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { router } from "expo-router";

import { strings } from "../../../copy/strings";
import { useDevReceiptStore } from "../../../monetization/dev-billing";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { PlanPage } from "../pages/plan-page";
import { resetSettingsStores } from "./settings-test-setup";

beforeEach(async () => {
  await resetSettingsStores();
});

describe("Settings → Subscription", () => {
  it("states the plan she holds and its price as facts, not buttons", () => {
    useEntitlementStore.setState({ purchase: { plan: "annual", date: "2026-09-05" } });
    const screen = render(<PlanPage />);
    expect(screen.getByText(strings.settings.restore.title)).toBeTruthy();
    expect(screen.getByText(strings.settings.plan.intro)).toBeTruthy();
    expect(screen.getByTestId("plan-row-plan-value")).toHaveTextContent(
      strings.paywall.plans.annual.label,
    );
    // The price is the billing port's offering for that plan.
    expect(screen.getByTestId("plan-row-price-value")).toHaveTextContent(
      strings.paywall.plans.annual.price,
    );
    expect(screen.getByTestId("plan-row-plan").props.accessibilityRole).toBeUndefined();
    expect(screen.getByTestId("plan-row-price").props.accessibilityRole).toBeUndefined();
  });

  it("a monthly plan and the lifetime plan read their own labels and prices", () => {
    useEntitlementStore.setState({ purchase: { plan: "monthly", date: "2026-09-05" } });
    const monthly = render(<PlanPage />);
    expect(monthly.getByTestId("plan-row-plan-value")).toHaveTextContent(
      strings.paywall.plans.monthly.label,
    );
    expect(monthly.getByTestId("plan-row-price-value")).toHaveTextContent(
      strings.paywall.plans.monthly.price,
    );
    monthly.unmount();
    useEntitlementStore.setState({ purchase: { plan: "lifetime", date: "2026-09-05" } });
    const lifetime = render(<PlanPage />);
    expect(lifetime.getByTestId("plan-row-plan-value")).toHaveTextContent(
      strings.paywall.plans.lifetime.label,
    );
    expect(lifetime.getByTestId("plan-row-price-value")).toHaveTextContent(
      strings.paywall.plans.lifetime.price,
    );
  });

  it("before any purchase says 'None yet' and shows no price; a store trial says 'Free week'", () => {
    const none = render(<PlanPage />);
    expect(none.getByTestId("plan-row-plan-value")).toHaveTextContent(strings.settings.plan.none);
    expect(none.queryByTestId("plan-row-price")).toBeNull();
    none.unmount();
    useEntitlementStore.setState({ purchase: { plan: "annual", date: "2026-09-05", trial: true } });
    const trial = render(<PlanPage />);
    expect(trial.getByTestId("plan-row-plan-value")).toHaveTextContent(strings.settings.plan.trial);
  });

  it("before any purchase, the page is the door to the subscription: Start my free week opens the paywall, and there is nothing to manage yet", () => {
    const screen = render(<PlanPage />);
    expect(screen.getByText(strings.settings.plan.introNone)).toBeTruthy();
    expect(screen.queryByText(strings.settings.plan.intro)).toBeNull();
    expect(screen.queryByTestId("settings-manage-subscription")).toBeNull();
    fireEvent.press(screen.getByTestId("settings-subscribe"));
    expect(router.push).toHaveBeenCalledWith("/settings/subscribe");
    // Restore stays: a reinstall with a receipt is the other way in.
    expect(screen.getByTestId("plan-restore")).toBeTruthy();
  });

  it("with a purchase, the door is gone and Manage subscription is back", () => {
    useEntitlementStore.setState({ purchase: { plan: "annual", date: "2026-09-05" } });
    const screen = render(<PlanPage />);
    expect(screen.queryByTestId("settings-subscribe")).toBeNull();
    expect(screen.getByTestId("settings-manage-subscription")).toBeTruthy();
    expect(screen.getByText(strings.settings.plan.intro)).toBeTruthy();
  });

  it("offers 'Manage subscription' — never a dead end — through the manage port", async () => {
    const { manageSubscription } = jest.requireActual<
      typeof import("../../../monetization/manage-subscription")
    >("../../../monetization/manage-subscription");
    const Linking = jest.requireActual<typeof import("react-native")>("react-native").Linking;
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    useEntitlementStore.setState({ purchase: { plan: "annual", date: "2026-09-05" } });
    const screen = render(<PlanPage />);
    fireEvent.press(screen.getByTestId("settings-manage-subscription"));
    // Without the store key the button opens Apple's own subscriptions page.
    await manageSubscription();
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith("https://apps.apple.com/account/subscriptions"),
    );
    open.mockRestore();
  });

  it("restore beneath: a found receipt grants quietly, nothing found says so, a failure says retry", async () => {
    useDevReceiptStore.setState({ receipt: { plan: "annual", date: "2026-08-20" } });
    const found = render(<PlanPage />);
    fireEvent.press(found.getByTestId("plan-restore"));
    await waitFor(() =>
      expect(useEntitlementStore.getState().purchase).toMatchObject({ plan: "annual" }),
    );
    expect(found.queryByTestId("settings-restore-empty")).toBeNull();
    expect(found.queryByTestId("settings-restore-error")).toBeNull();
    // The page now states the restored plan (feedback where she looks).
    await waitFor(() =>
      expect(found.getByTestId("plan-row-plan-value")).toHaveTextContent(
        strings.paywall.plans.annual.label,
      ),
    );
    found.unmount();

    useDevReceiptStore.setState({ receipt: null });
    useEntitlementStore.setState({ purchase: null });
    const empty = render(<PlanPage />);
    fireEvent.press(empty.getByTestId("plan-restore"));
    await waitFor(() => expect(empty.getByText(strings.paywall.restoreEmpty)).toBeTruthy());
    expect(empty.queryByText(strings.paywall.restoreError)).toBeNull();
    empty.unmount();

    useDevReceiptStore.setState({ hydrated: false, hydrationFailed: true });
    const failed = render(<PlanPage />);
    fireEvent.press(failed.getByTestId("plan-restore"));
    await waitFor(() => expect(failed.getByText(strings.paywall.restoreError)).toBeTruthy());
    expect(failed.queryByText(strings.paywall.restoreEmpty)).toBeNull();
  });

  it("renders no user-facing text outside strings.ts", async () => {
    useEntitlementStore.setState({ purchase: { plan: "annual", date: "2026-09-05" } });
    const allowed = collectStringValues(strings);
    const screen = render(<PlanPage />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
    useDevReceiptStore.setState({ receipt: null });
    fireEvent.press(screen.getByTestId("plan-restore"));
    await waitFor(() => expect(screen.getByText(strings.paywall.restoreEmpty)).toBeTruthy());
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
