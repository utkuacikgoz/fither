import AsyncStorage from "@react-native-async-storage/async-storage";

import { useDevReceiptStore } from "../../monetization/dev-billing";
import { useEntitlementStore } from "../entitlement-store";
import { useLifetimeOfferStore } from "../lifetime-offer-store";

// "We'll only ask once" is a promise: the asked date is written before
// the screen is pushed, and nothing after can ask again.

beforeEach(async () => {
  await AsyncStorage.clear();
  useLifetimeOfferStore.setState({ offeredDate: null, hydrated: true, hydrationFailed: false });
  useDevReceiptStore.setState({ receipt: null, trialCancelled: false, hydrated: true, hydrationFailed: false });
  useEntitlementStore.setState({ purchase: null, trialStartDate: null, hydrated: true, hydrationFailed: false });
});

it("asks once, when the store says the trial is cancelled — and never again", async () => {
  expect(await useLifetimeOfferStore.getState().claimOffer("2026-09-05")).toBe(false);
  useDevReceiptStore.getState().setTrialCancelled(true);
  expect(await useLifetimeOfferStore.getState().claimOffer("2026-09-05")).toBe(true);
  expect(useLifetimeOfferStore.getState().offeredDate).toBe("2026-09-05");
  expect(await useLifetimeOfferStore.getState().claimOffer("2026-09-06")).toBe(false);
});

it("never asks someone who already owns it, or before hydration", async () => {
  useDevReceiptStore.getState().setTrialCancelled(true);
  useEntitlementStore.setState({ purchase: { plan: "lifetime", date: "2026-09-01" } });
  expect(await useLifetimeOfferStore.getState().claimOffer("2026-09-05")).toBe(false);
  useEntitlementStore.setState({ purchase: null });
  useLifetimeOfferStore.setState({ hydrated: false });
  expect(await useLifetimeOfferStore.getState().claimOffer("2026-09-05")).toBe(false);
});
