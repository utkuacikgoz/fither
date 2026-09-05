import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";

import { strings } from "../copy/strings";
import { todayIso } from "../lib/dates";
import type {
  BillingPort,
  Offering,
  PlanId,
  PurchaseOutcome,
  PurchaseRecord,
  RestoreOutcome,
} from "./billing";

// The store, behind the billing port (ADR-0009 §4; plans ADR-0014).
// Everything here is opportunistic: the app-side entitlement store stays
// canonical and is evaluated offline, so a paying user in airplane mode
// is never locked out and nothing on the training path waits on this
// file. RevenueCat caches customer info on device; we keep the last
// info we saw so the synchronous port reads never block.
//
// Dashboard shape this adapter expects (docs/revenuecat-setup.md):
//   entitlement  "fither_pro"
//   products     "yearly", "monthly", "lifetime" (App Store product ids)
//   offering     the CURRENT offering, one package per product
// A package is matched by its product id first, then by its package
// type, so the owner's package identifiers can be anything. The 7-day
// free trial is the yearly product's introductory offer.

/** The RevenueCat entitlement identifier. One entitlement covers everything. */
export const ENTITLEMENT_ID = "fither_pro";

/** The App Store product identifiers, per plan (owner's dashboard). */
export const PRODUCT_IDS: Record<PlanId, string> = {
  annual: "yearly",
  monthly: "monthly",
  lifetime: "lifetime",
};

/** Public (client) API key for iOS; undefined means "use the dev adapter". */
const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

/** ADR-0014: the lifetime offer waits until day 3 of the trial. */
export const LIFETIME_OFFER_TRIAL_DAY = 3;

export function revenueCatConfigured(): boolean {
  return typeof API_KEY === "string" && API_KEY.length > 0;
}

let configured = false;
let lastInfo: CustomerInfo | null = null;

function ensureConfigured(): void {
  if (configured || !API_KEY) return;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey: API_KEY });
  Purchases.addCustomerInfoUpdateListener((info) => {
    lastInfo = info;
  });
  configured = true;
}

function planOf(pkg: PurchasesPackage): PlanId | null {
  const byProduct = (Object.keys(PRODUCT_IDS) as PlanId[]).find(
    (plan) => PRODUCT_IDS[plan] === pkg.product.identifier,
  );
  if (byProduct) return byProduct;
  switch (pkg.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return "annual";
    case PACKAGE_TYPE.MONTHLY:
      return "monthly";
    case PACKAGE_TYPE.LIFETIME:
      return "lifetime";
    default:
      return null;
  }
}

function offeringOf(pkg: PurchasesPackage, plan: PlanId): Offering {
  // The store's localised price leads; the annual note is our own plain
  // arithmetic and only true for the USD reference price, so it is
  // shown only when the store's label matches that reference.
  const reference = strings.paywall.plans[plan];
  const localised = pkg.product.priceString;
  const note =
    "note" in reference && localised === reference.price ? reference.note : undefined;
  return note ? { plan, priceLabel: localised, noteLabel: note } : { plan, priceLabel: localised };
}

let packages: Partial<Record<PlanId, PurchasesPackage>> = {};
let offeringsCache: readonly Offering[] = [];
let lifetimeCache: Offering | null = null;

/** Fetch the current offering once per process; failures leave the fallbacks. */
async function loadOfferings(): Promise<void> {
  ensureConfigured();
  try {
    const { current } = await Purchases.getOfferings();
    if (!current) return;
    const next: Partial<Record<PlanId, PurchasesPackage>> = {};
    for (const pkg of current.availablePackages) {
      const plan = planOf(pkg);
      if (plan) next[plan] = pkg;
    }
    packages = next;
    const paywall: Offering[] = [];
    if (next.annual) paywall.push(offeringOf(next.annual, "annual"));
    if (next.monthly) paywall.push(offeringOf(next.monthly, "monthly"));
    offeringsCache = paywall;
    lifetimeCache = next.lifetime ? offeringOf(next.lifetime, "lifetime") : null;
  } catch {
    // Offline or store unreachable: the reference strings stand in.
  }
}

/** The app-side record of an active entitlement, or null. */
function recordOf(info: CustomerInfo): PurchaseRecord | null {
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  if (!entitlement) return null;
  const plan =
    (Object.keys(PRODUCT_IDS) as PlanId[]).find(
      (candidate) => PRODUCT_IDS[candidate] === entitlement.productIdentifier,
    ) ?? null;
  return {
    // A product we cannot map still entitles her — the entitlement is
    // the store's word; the plan label is ours.
    plan: plan ?? "annual",
    date: entitlement.latestPurchaseDate.slice(0, 10) || todayIso(),
  };
}

/** Whole days from an ISO instant to today, local. */
function daysSince(iso: string): number {
  const ms = Date.parse(`${todayIso()}T00:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

const fallbackOfferings: readonly Offering[] = [
  {
    plan: "annual",
    priceLabel: strings.paywall.plans.annual.price,
    noteLabel: strings.paywall.plans.annual.note,
  },
  { plan: "monthly", priceLabel: strings.paywall.plans.monthly.price },
];

export const revenueCatBilling: BillingPort = {
  getOfferings(): readonly Offering[] {
    void loadOfferings();
    return offeringsCache.length > 0 ? offeringsCache : fallbackOfferings;
  },

  getLifetimeOffering(): Offering | null {
    void loadOfferings();
    return (
      lifetimeCache ?? {
        plan: "lifetime",
        priceLabel: strings.paywall.plans.lifetime.price,
        noteLabel: strings.paywall.plans.lifetime.note,
      }
    );
  },

  getEntitlement(): PurchaseRecord | null {
    return lastInfo ? recordOf(lastInfo) : null;
  },

  async purchase(plan: PlanId): Promise<PurchaseOutcome> {
    await loadOfferings();
    const pkg = packages[plan];
    if (!pkg) return { ok: false, reason: "failed" };
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      lastInfo = customerInfo;
      const purchase = recordOf(customerInfo);
      return purchase ? { ok: true, purchase } : { ok: false, reason: "failed" };
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { ok: false, reason: "cancelled" };
      }
      return { ok: false, reason: "failed" };
    }
  },

  async restore(): Promise<RestoreOutcome> {
    try {
      await loadOfferings();
      const info = await Purchases.restorePurchases();
      lastInfo = info;
      const purchase = recordOf(info);
      return purchase ? { ok: true, purchase } : { ok: false, reason: "nothingToRestore" };
    } catch {
      return { ok: false, reason: "failed" };
    }
  },

  async lifetimeOfferEligible(): Promise<boolean> {
    try {
      ensureConfigured();
      const info = await Purchases.getCustomerInfo();
      lastInfo = info;
      const entitlement = info.entitlements.active[ENTITLEMENT_ID];
      if (!entitlement) return false;
      return (
        entitlement.periodType === "TRIAL" &&
        entitlement.willRenew === false &&
        daysSince(entitlement.latestPurchaseDate) >= LIFETIME_OFFER_TRIAL_DAY
      );
    } catch {
      return false;
    }
  },
};
