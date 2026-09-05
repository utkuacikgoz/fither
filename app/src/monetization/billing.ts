// The billing port (ADR-0009 §4, plans per ADR-0014). The app talks to
// billing ONLY through this interface; the entitlement store is the
// app-side record of what was granted and is evaluated offline. Two
// implementations: revenuecat-billing (the store, selected when the
// public API key is configured) and dev-billing (instant success, no
// network, no SDK — the fallback in development and in tests). The
// adapter is consulted opportunistically, never on the training path
// (airplane-mode rule).

import { devBilling } from "./dev-billing";
import { revenueCatBilling, revenueCatConfigured } from "./revenuecat-billing";

/**
 * The plans (ADR-0014): annual is the plan the paywall leads with,
 * monthly sits beside it, and lifetime is never on the paywall — it is
 * offered once, on day 3 of the trial, only to someone who has switched
 * off the trial's auto-renew.
 */
export type PlanId = "annual" | "monthly" | "lifetime";

/**
 * A purchasable plan as display data. `priceLabel` comes from the
 * provider's localised offering when one exists; the USD reference
 * strings in strings.ts are the fallback the dev adapter carries.
 */
export interface Offering {
  plan: PlanId;
  priceLabel: string;
  /** Plain arithmetic on the real price (annual only) — never a discount theatric. */
  noteLabel?: string;
}

/** A granted purchase, as the app records it. Date is local ISO yyyy-mm-dd. */
export interface PurchaseRecord {
  plan: PlanId;
  date: string;
  /** The store's free introductory week is running (ADR-0014 §6). */
  trial?: boolean;
}

export type PurchaseOutcome =
  | { ok: true; purchase: PurchaseRecord }
  /** She closed the store sheet. Not an error; nothing to say. */
  | { ok: false; reason: "cancelled" }
  | { ok: false; reason: "failed" };

export type RestoreOutcome =
  | { ok: true; purchase: PurchaseRecord }
  | { ok: false; reason: "nothingToRestore" | "failed" };

export interface BillingPort {
  /** The paywall's plans: annual first (annual led), then monthly. Never lifetime. */
  getOfferings(): readonly Offering[];
  /** The one-time plan, for the day-3 offer only; null if the store has none. */
  getLifetimeOffering(): Offering | null;
  /**
   * The provider's own view of entitlement, if it has one cached. The
   * app-side entitlement store stays canonical for offline gating; this
   * exists so a real adapter can be consulted opportunistically.
   */
  getEntitlement(): PurchaseRecord | null;
  purchase(plan: PlanId): Promise<PurchaseOutcome>;
  restore(): Promise<RestoreOutcome>;
  /**
   * The store's current word on entitlement, fetched: a record, null
   * for "nothing active" (a lapsed trial), or undefined for "no
   * opinion" (the dev adapter, or the store unreachable) — in which case
   * the app-side record stands. Called opportunistically at launch,
   * never on the training path.
   */
  refreshEntitlement(): Promise<PurchaseRecord | null | undefined>;
  /**
   * ADR-0014: whether she is inside the store's free trial with
   * auto-renew switched off, at least three days in — the one condition
   * under which the lifetime offer may be shown (once). Read from the
   * store's customer info; the dev adapter simulates it.
   */
  lifetimeOfferEligible(): Promise<boolean>;
}

/**
 * The active billing implementation: the store when its key is
 * configured (EXPO_PUBLIC_REVENUECAT_IOS_KEY, see docs/revenuecat-setup.md),
 * the dev adapter otherwise — so a checkout without the key, and every
 * test, keeps the fully clickable no-network flow.
 */
export function getBilling(): BillingPort {
  return revenueCatConfigured() ? revenueCatBilling : devBilling;
}
