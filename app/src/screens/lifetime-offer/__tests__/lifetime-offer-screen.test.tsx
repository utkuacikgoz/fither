import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { WORDMARK } from "../../../design/primitives/wordmark";
import { glyph } from "../../../design/tokens";
import { useDevReceiptStore } from "../../../monetization/dev-billing";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { LifetimeOfferScreen } from "../lifetime-offer-screen";

beforeEach(() => {
  useDevReceiptStore.setState({ receipt: null, trialCancelled: true, hydrated: true, hydrationFailed: false });
  useEntitlementStore.setState({ purchase: null, trialStartDate: "2026-09-01", hydrated: true, hydrationFailed: false });
});

it("shows the one plan with its price on the row, not in prose, and nothing about renewal", () => {
  const screen = render(<LifetimeOfferScreen onDone={jest.fn()} />);
  expect(screen.getByText(strings.lifetimeOffer.headline)).toBeTruthy();
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

it("renders no user-facing text outside strings.ts", () => {
  const allowed = collectStringValues(strings);
  allowed.add(WORDMARK); // the brand mark is not copy (same allowance as the paywall)
  allowed.add(glyph.check); // the selected plan row's decorative check, not copy
  const screen = render(<LifetimeOfferScreen onDone={jest.fn()} />);
  for (const leaf of renderedTextLeaves(screen.toJSON())) {
    expect(allowed.has(leaf) ? true : leaf).toBe(true);
  }
});
