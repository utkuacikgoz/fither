import Purchases from "react-native-purchases";

import type { BillingPort } from "../billing";

type DevAnalytics = typeof import("../../analytics/dev-analytics");

// The store customer and the analytics person are the same person
// (drop-off pass, 2026-09-08). These tests configure the adapter for
// real — a key in the environment before the module loads — which the
// sibling suite deliberately never does.

const mocked = Purchases as unknown as {
  configure: jest.Mock;
  getAppUserID: jest.Mock;
  logIn: jest.Mock;
  logOut: jest.Mock;
};

// The adapter and the dev analytics it aliases into are loaded together
// in one isolated module graph, so the record read back is the one the
// adapter wrote to.
function loadConfigured(withKey = true): { billing: BillingPort; analytics: DevAnalytics } {
  let loaded: { billing: BillingPort; analytics: DevAnalytics } | null = null;
  jest.isolateModules(() => {
    if (withKey) process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = "appl_test";
    const billing = (require("../revenuecat-billing") as { revenueCatBilling: BillingPort }).revenueCatBilling;
    const analytics = require("../../analytics/dev-analytics") as DevAnalytics;
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    loaded = { billing, analytics };
  });
  if (!loaded) throw new Error("adapter did not load");
  return loaded;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mocked.configure.mockClear();
  mocked.logIn.mockClear();
  mocked.logOut.mockClear();
});

it("aliases the store's anonymous customer id to the analytics person once configured", async () => {
  const { billing, analytics } = loadConfigured();
  await billing.setUser("hash-1");
  await settle();
  expect(mocked.configure).toHaveBeenCalledTimes(1);
  expect(analytics.recordedAliases()).toEqual(["$RCAnonymousID:test"]);
});

it("logs the customer in as the analytics distinct id, and out again", async () => {
  const { billing } = loadConfigured();
  await billing.setUser("hash-1");
  expect(mocked.logIn).toHaveBeenCalledWith("hash-1");
  await billing.clearUser();
  expect(mocked.logOut).toHaveBeenCalledTimes(1);
});

it("swallows a store refusal on either side", async () => {
  const { billing } = loadConfigured();
  mocked.logIn.mockRejectedValueOnce(new Error("offline"));
  mocked.logOut.mockRejectedValueOnce(new Error("anonymous"));
  await expect(billing.setUser("hash-2")).resolves.toBeUndefined();
  await expect(billing.clearUser()).resolves.toBeUndefined();
});

it("does nothing without a key: the dev adapter's world", async () => {
  const { billing, analytics } = loadConfigured(false);
  await billing.setUser("hash-3");
  await billing.clearUser();
  await settle();
  expect(mocked.logIn).not.toHaveBeenCalled();
  expect(mocked.logOut).not.toHaveBeenCalled();
  expect(analytics.recordedAliases()).toEqual([]);
});
