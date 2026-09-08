import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { clearRecordedEvents, recordedEvents } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { WORDMARK } from "../../../design/primitives/wordmark";
import { glyph } from "../../../design/tokens";
import { getBilling } from "../../../monetization/billing";
import { useDevReceiptStore } from "../../../monetization/dev-billing";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { LifetimeOfferScreen } from "../lifetime-offer-screen";

beforeEach(() => {
  clearRecordedEvents();
  useDevReceiptStore.setState({ receipt: null, trialCancelled: true, hydrated: true, hydrationFailed: false });
  useEntitlementStore.setState({ purchase: null, trialStartDate: "2026-09-01", hydrated: true, hydrationFailed: false });
});

it("shows the one plan with its price on the row, not in prose, and nothing about renewal", () => {
  const screen = render(<LifetimeOfferScreen onDone={jest.fn()} />);
  expect(screen.getByText(strings.lifetimeOffer.headline)).toBeTruthy();
  expect(screen.getByText(strings.lifetimeOffer.lead)).toBeTruthy();
  expect(screen.getByTestId("lifetime-offer-ladder")).toBeTruthy();
  expect(screen.getByText(strings.paywall.plans.lifetime.price)).toBeTruthy();
  expect(screen.getByText(strings.paywall.plans.lifetime.note)).toBeTruthy();
  expect(screen.queryByText(strings.paywall.afterTrialNote(strings.paywall.plans.lifetime.price))).toBeNull();
});

it("paying once records a lifetime purchase and leaves", async () => {
  const onDone = jest.fn();
  const screen = render(<LifetimeOfferScreen onDone={onDone} />);
  fireEvent.press(screen.getByTestId("lifetime-offer-buy"));
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(useEntitlementStore.getState().purchase?.plan).toBe("lifetime");
});

it("declining is equal dignity: one tap, no question, nothing recorded as bought", () => {
  const onDone = jest.fn();
  const screen = render(<LifetimeOfferScreen onDone={onDone} />);
  fireEvent.press(screen.getByTestId("lifetime-offer-decline"));
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(useEntitlementStore.getState().purchase).toBeNull();
});

describe("lifetime_offer", () => {
  const offers = () => recordedEvents().filter((e) => e.name === "lifetime_offer");

  it("reports view once when the letter is shown, and decline on the quiet way out", () => {
    const screen = render(<LifetimeOfferScreen onDone={jest.fn()} />);
    expect(offers()).toEqual([{ name: "lifetime_offer", properties: { action: "view" } }]);
    screen.rerender(<LifetimeOfferScreen onDone={jest.fn()} />);
    expect(offers()).toHaveLength(1);
    fireEvent.press(screen.getByTestId("lifetime-offer-decline"));
    expect(offers().map((e) => e.properties)).toEqual([{ action: "view" }, { action: "decline" }]);
  });

  it("paying is not a decline: the purchase reports itself, the offer only its view", async () => {
    const onDone = jest.fn();
    const screen = render(<LifetimeOfferScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId("lifetime-offer-buy"));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(offers().map((e) => e.properties)).toEqual([{ action: "view" }]);
    expect(recordedEvents().filter((e) => e.name === "purchase_result")).toEqual([
      { name: "purchase_result", properties: { plan: "lifetime", outcome: "purchased" } },
    ]);
  });

  it("a store with no lifetime product shows nothing and reports no view", () => {
    const spy = jest.spyOn(getBilling(), "getLifetimeOffering").mockReturnValue(null);
    const onDone = jest.fn();
    render(<LifetimeOfferScreen onDone={onDone} />);
    expect(onDone).toHaveBeenCalled();
    expect(offers()).toEqual([]);
    spy.mockRestore();
  });
});

it("renders no user-facing text outside strings.ts", () => {
  const allowed = collectStringValues(strings);
  allowed.add(WORDMARK); // the brand mark is not copy (same allowance as the paywall)
  allowed.add(glyph.check); // the selected plan row's decorative check, not copy
  const screen = render(<LifetimeOfferScreen onDone={jest.fn()} />);
  for (const leaf of renderedTextLeaves(screen.toJSON())) {
    expect(allowed.has(leaf) ? true : leaf).toBe(true);
  }
});
