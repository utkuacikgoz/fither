import Purchases, { PACKAGE_TYPE, PURCHASES_ERROR_CODE } from "react-native-purchases";

import {
  ENTITLEMENT_ID,
  LIFETIME_OFFER_TRIAL_DAY,
  revenueCatBilling,
} from "../revenuecat-billing";
import { todayIso } from "../../lib/dates";

// The store adapter over the mocked SDK (jest-setup). Everything is
// mapped through the owner's ids: entitlement fither_pro, products
// yearly / monthly / lifetime.

const mocked = Purchases as unknown as {
  getOfferings: jest.Mock;
  purchasePackage: jest.Mock;
  restorePurchases: jest.Mock;
  getCustomerInfo: jest.Mock;
};

function pkg(productId: string, packageType: string, priceString: string) {
  return { identifier: `$rc_${productId}`, packageType, product: { identifier: productId, priceString } };
}

function info(entitlement: Record<string, unknown> | null) {
  return { entitlements: { active: entitlement ? { [ENTITLEMENT_ID]: entitlement } : {} } };
}

const isoDaysAgo = (days: number) => {
  const d = new Date(`${todayIso()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
};

beforeEach(() => {
  mocked.getOfferings.mockResolvedValue({
    current: {
      availablePackages: [
        pkg("yearly", PACKAGE_TYPE.ANNUAL, "$59.99"),
        pkg("monthly", PACKAGE_TYPE.MONTHLY, "$12.99"),
        pkg("lifetime", PACKAGE_TYPE.LIFETIME, "$99.00"),
      ],
    },
  });
});

it("maps the owner's products by id: yearly and monthly on the paywall, lifetime apart", async () => {
  await revenueCatBilling.purchase("annual").catch(() => undefined);
  const offerings = revenueCatBilling.getOfferings();
  expect(offerings.map((o) => o.plan)).toEqual(["annual", "monthly"]);
  expect(offerings[0]?.priceLabel).toBe("$59.99");
  expect(revenueCatBilling.getLifetimeOffering()?.plan).toBe("lifetime");
});

it("a purchase grants the app-side record from the store's entitlement", async () => {
  mocked.purchasePackage.mockResolvedValue({
    customerInfo: info({ productIdentifier: "lifetime", latestPurchaseDate: `${todayIso()}T09:00:00Z` }),
  });
  const outcome = await revenueCatBilling.purchase("lifetime");
  expect(outcome).toEqual({ ok: true, purchase: { plan: "lifetime", date: todayIso() } });
});

it("closing the sheet is 'cancelled', a process error is 'failed'", async () => {
  mocked.purchasePackage.mockRejectedValueOnce({ code: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR });
  expect(await revenueCatBilling.purchase("annual")).toEqual({ ok: false, reason: "cancelled" });
  mocked.purchasePackage.mockRejectedValueOnce(new Error("network"));
  expect(await revenueCatBilling.purchase("annual")).toEqual({ ok: false, reason: "failed" });
});

it("restore distinguishes nothing-to-restore from failure", async () => {
  mocked.restorePurchases.mockResolvedValueOnce(info(null));
  expect(await revenueCatBilling.restore()).toEqual({ ok: false, reason: "nothingToRestore" });
  mocked.restorePurchases.mockRejectedValueOnce(new Error("offline"));
  expect(await revenueCatBilling.restore()).toEqual({ ok: false, reason: "failed" });
});

it("the lifetime offer is due only in a cancelled trial, from day 3 (ADR-0014)", async () => {
  const trial = (willRenew: boolean, daysAgo: number, periodType = "TRIAL") =>
    info({ productIdentifier: "yearly", periodType, willRenew, latestPurchaseDate: isoDaysAgo(daysAgo) });
  mocked.getCustomerInfo.mockResolvedValueOnce(trial(false, LIFETIME_OFFER_TRIAL_DAY));
  expect(await revenueCatBilling.lifetimeOfferEligible()).toBe(true);
  mocked.getCustomerInfo.mockResolvedValueOnce(trial(false, LIFETIME_OFFER_TRIAL_DAY - 1));
  expect(await revenueCatBilling.lifetimeOfferEligible()).toBe(false);
  mocked.getCustomerInfo.mockResolvedValueOnce(trial(true, 5));
  expect(await revenueCatBilling.lifetimeOfferEligible()).toBe(false);
  mocked.getCustomerInfo.mockResolvedValueOnce(trial(false, 5, "NORMAL"));
  expect(await revenueCatBilling.lifetimeOfferEligible()).toBe(false);
  mocked.getCustomerInfo.mockResolvedValueOnce(info(null));
  expect(await revenueCatBilling.lifetimeOfferEligible()).toBe(false);
});
