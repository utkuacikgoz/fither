// The billing port (ADR-0009 §4). The app talks to billing ONLY through
// this interface; the entitlement store is the app-side record of what was
// granted and is evaluated offline. The only implementation today is
// dev-billing (instant success, no network, no SDK). Wiring the real
// provider later means implementing this same interface in a new adapter
// and switching `getBilling()` — nothing else changes. The adapter is
// consulted opportunistically, never on the training path (airplane-mode
// rule).

import { devBilling } from "./dev-billing";

/** The two ADR-0002 plans. Annual is the plan the paywall leads with. */
export type PlanId = "annual" | "monthly";

/**
 * A purchasable plan as display data. `priceLabel` comes from the
 * provider's localised offering when one exists; the GBP reference
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
}

export type PurchaseOutcome =
  | { ok: true; purchase: PurchaseRecord }
  | { ok: false; reason: "failed" };

export type RestoreOutcome =
  | { ok: true; purchase: PurchaseRecord }
  | { ok: false; reason: "nothingToRestore" | "failed" };

export interface BillingPort {
  /** The two plans, annual first (annual led — ADR-0002). */
  getOfferings(): readonly Offering[];
  /**
   * The provider's own view of entitlement, if it has one cached. The
   * app-side entitlement store stays canonical for offline gating; this
   * exists so a real adapter can be consulted opportunistically.
   */
  getEntitlement(): PurchaseRecord | null;
  purchase(plan: PlanId): Promise<PurchaseOutcome>;
  restore(): Promise<RestoreOutcome>;
}

/** The active billing implementation. Dev-only until the real adapter lands. */
export function getBilling(): BillingPort {
  return devBilling;
}
