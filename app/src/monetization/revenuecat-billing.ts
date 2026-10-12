import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";

import { alias } from "../analytics/analytics";
import { strings } from "../copy/strings";
import { captureError } from "../monitoring/monitoring";
import { todayIso } from "../lib/dates";
import { FREE_TRIAL_DAYS } from "./dev-billing";
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
// free trial is each subscription's introductory offer; the paywall
// shows it only when the store has one and Apple says she can take it.

/** The RevenueCat entitlement identifier. One entitlement covers everything. */
export const ENTITLEMENT_ID = "fither_pro";

/**
 * The App Store product identifiers, per plan (owner's dashboard). Matched
 * without regard to case: the yearly product was created in App Store
 * Connect as "Yearly" (2026-10-02), and an id can never be renamed there.
 */
export const PRODUCT_IDS: Record<PlanId, string> = {
  annual: "yearly",
  monthly: "monthly",
  lifetime: "lifetime",
};

/** The plan a store product id names, ignoring case; null for none. */
export function planForProductId(productId: string): PlanId | null {
  const id = productId.toLowerCase();
  return (Object.keys(PRODUCT_IDS) as PlanId[]).find((plan) => PRODUCT_IDS[plan] === id) ?? null;
}

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
  // The store's anonymous customer id becomes an alias of the analytics
  // person, so RevenueCat's server-side purchase events (its PostHog
  // integration) land on the same person as the app's own events, even
  // for a guest who never signs in.
  Purchases.getAppUserID()
    .then((id) => alias(id))
    .catch(() => {
      // No id, no alias; the app-side events still stand on their own.
    });
}

function planOf(pkg: PurchasesPackage): PlanId | null {
  const byProduct = planForProductId(pkg.product.identifier);
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

/**
 * Days of a free introductory offer on a store product: the offer must
 * cost nothing and run in days or weeks (the paywall says "7 days
 * free"; a month-long offer would need other words, so it is not
 * claimed). Null for none.
 */
export function freeIntroDays(pkg: PurchasesPackage): number | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const units = intro.periodNumberOfUnits * Math.max(1, intro.cycles);
  if (intro.periodUnit === "DAY") return units;
  if (intro.periodUnit === "WEEK") return units * 7;
  return null;
}

function offeringOf(pkg: PurchasesPackage, plan: PlanId, eligible: boolean): Offering {
  // The store's localised price leads, with its period ("$59.99/year").
  // The annual note is our own plain arithmetic and only true for the
  // USD reference price, so it is shown only when the store's label
  // matches that reference; the lifetime note is a fact, always true.
  const reference = strings.paywall.plans[plan];
  const priceLabel = `${pkg.product.priceString}${reference.per}`;
  const note =
    plan === "lifetime" || (plan === "annual" && priceLabel === reference.price)
      ? "note" in reference
        ? reference.note
        : undefined
      : undefined;
  const days = eligible ? freeIntroDays(pkg) : null;
  return {
    plan,
    priceLabel,
    ...(note ? { noteLabel: note } : {}),
    ...(days ? { freeTrialDays: days } : {}),
  };
}

/**
 * Which products' introductory offers she can still take. Apple gives an
 * intro offer once per subscription group, so someone who subscribed
 * before is told the plain price, never a week the sheet will not give.
 * Unknown or a failed check reads as not eligible (RevenueCat's advice:
 * never show a misleading intro price).
 */
async function introEligible(productIds: readonly string[]): Promise<ReadonlySet<string>> {
  if (productIds.length === 0) return new Set();
  try {
    const result = await Purchases.checkTrialOrIntroductoryPriceEligibility([...productIds]);
    return new Set(
      productIds.filter(
        (id) => result[id]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE,
      ),
    );
  } catch (error) {
    captureError(storeError(error, "intro eligibility check failed"), "billing.offerings");
    return new Set();
  }
}

let packages: Partial<Record<PlanId, PurchasesPackage>> = {};
let offeringsCache: readonly Offering[] = [];
let lifetimeCache: Offering | null = null;

let loading: Promise<void> | null = null;

/** Fetch the current offering; concurrent callers share one fetch. Failures leave the fallbacks. */
function loadOfferings(): Promise<void> {
  loading ??= fetchCurrentOffering().finally(() => {
    loading = null;
  });
  return loading;
}

async function fetchCurrentOffering(): Promise<void> {
  ensureConfigured();
  try {
    const { current } = await Purchases.getOfferings();
    if (!current) {
      captureError(new Error("no current offering"), "billing.offerings");
      return;
    }
    const next: Partial<Record<PlanId, PurchasesPackage>> = {};
    for (const pkg of current.availablePackages) {
      const plan = planOf(pkg);
      if (plan) next[plan] = pkg;
    }
    if (!next.annual || !next.monthly) {
      captureError(
        new Error(
          `offering ${current.identifier} lacks a plan; packages: ${current.availablePackages
            .map((pkg) => `${pkg.packageType}/${pkg.product.identifier}`)
            .join(", ") || "none"}`,
        ),
        "billing.offerings",
      );
    }
    packages = next;
    const subscriptions = [next.annual, next.monthly].filter(
      (pkg): pkg is PurchasesPackage => pkg !== undefined && freeIntroDays(pkg) !== null,
    );
    const eligible = await introEligible(subscriptions.map((pkg) => pkg.product.identifier));
    const isEligible = (pkg: PurchasesPackage) => eligible.has(pkg.product.identifier);
    const paywall: Offering[] = [];
    if (next.annual) paywall.push(offeringOf(next.annual, "annual", isEligible(next.annual)));
    if (next.monthly) paywall.push(offeringOf(next.monthly, "monthly", isEligible(next.monthly)));
    offeringsCache = paywall;
    lifetimeCache = next.lifetime ? offeringOf(next.lifetime, "lifetime", false) : null;
  } catch (error) {
    // Offline or store unreachable: the reference strings stand in.
    captureError(storeError(error, "getOfferings failed"), "billing.offerings");
  }
}

/** The app-side record of an active entitlement, or null. */
function recordOf(info: CustomerInfo): PurchaseRecord | null {
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  if (!entitlement) return null;
  const plan = planForProductId(entitlement.productIdentifier);
  const record: PurchaseRecord = {
    // A product we cannot map still entitles her — the entitlement is
    // the store's word; the plan label is ours.
    plan: plan ?? "annual",
    date: entitlement.latestPurchaseDate.slice(0, 10) || todayIso(),
  };
  return entitlement.periodType === "TRIAL" ? { ...record, trial: true } : record;
}

/**
 * The store's own words for a failure, for the crash reporter: the
 * RevenueCat code, its readable name and StoreKit's underlying message.
 * A swallowed store error once cost a review round (2026-10-02: the
 * store returned no products and the button failed with no trace).
 * Never shown to her; the screen keeps its one calm line.
 */
export function storeError(error: unknown, fallback: string): Error {
  const e = (error ?? {}) as {
    code?: unknown;
    readableErrorCode?: unknown;
    message?: unknown;
    underlyingErrorMessage?: unknown;
  };
  const parts = [e.code, e.readableErrorCode, e.message, e.underlyingErrorMessage]
    .filter((part) => part !== undefined && part !== null && String(part).length > 0)
    .map(String);
  return new Error(parts.length > 0 ? parts.join(" | ") : fallback);
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
    freeTrialDays: FREE_TRIAL_DAYS,
  },
  { plan: "monthly", priceLabel: strings.paywall.plans.monthly.price, freeTrialDays: FREE_TRIAL_DAYS },
];

export const revenueCatBilling: BillingPort = {
  async setUser(distinctId): Promise<void> {
    ensureConfigured();
    if (!configured) return;
    try {
      await Purchases.logIn(distinctId);
    } catch {
      // The customer stays anonymous; entitlement is unaffected.
    }
  },
  async clearUser(): Promise<void> {
    if (!configured) return;
    try {
      await Purchases.logOut();
    } catch {
      // Already anonymous (logOut rejects then); nothing to do.
    }
  },
  getOfferings(): readonly Offering[] {
    void loadOfferings();
    return offeringsCache.length > 0 ? offeringsCache : fallbackOfferings;
  },

  async fetchOfferings(): Promise<readonly Offering[]> {
    await loadOfferings();
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
    if (!pkg) {
      captureError(new Error(`no ${plan} package from the store`), "billing.purchase");
      return { ok: false, reason: "failed" };
    }
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      lastInfo = customerInfo;
      const purchase = recordOf(customerInfo);
      if (!purchase) {
        captureError(
          new Error(`purchase of ${plan} granted no ${ENTITLEMENT_ID} entitlement`),
          "billing.purchase",
        );
      }
      return purchase ? { ok: true, purchase } : { ok: false, reason: "failed" };
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { ok: false, reason: "cancelled" };
      }
      captureError(storeError(error, "purchasePackage failed"), "billing.purchase");
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

  async refreshEntitlement(): Promise<PurchaseRecord | null | undefined> {
    try {
      ensureConfigured();
      const info = await Purchases.getCustomerInfo();
      lastInfo = info;
      return recordOf(info);
    } catch {
      return undefined;
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
