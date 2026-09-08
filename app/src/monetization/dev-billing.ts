// DEV-ONLY billing implementation (ADR-0009 §4): instant success, zero
// network, zero SDK. It exists so every flow — paywall, purchase, restore,
// offline entitlement — is fully clickable before the real provider is
// wired. Its one piece of state is a persisted fake "receipt" that plays
// the role of the store account: the dev reset control clears the
// app-side entitlement but NOT the receipt, so the restore path can be
// exercised exactly like real life (the store still knows you paid).
// Deleted wholesale when the real adapter lands.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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

interface DevReceiptState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** The fake store-side receipt. Survives the dev entitlement reset. */
  receipt: PurchaseRecord | null;
  setReceipt: (receipt: PurchaseRecord) => void;
  /**
   * DEV: simulate "she switched off the trial's auto-renew, three days
   * in" — the store fact the lifetime offer (ADR-0014) waits for. The
   * real adapter reads it from the customer info; here Settings' dev
   * tools flip it so the offer can be walked without a sandbox.
   */
  trialCancelled: boolean;
  setTrialCancelled: (cancelled: boolean) => void;
}

export const useDevReceiptStore = create<DevReceiptState>()(
  persist(
    (set) => ({
      receipt: null,
      trialCancelled: false,
      hydrated: false,
      hydrationFailed: false,
      setReceipt: (receipt) => set({ receipt }),
      setTrialCancelled: (trialCancelled) => set({ trialCancelled }),
    }),
    {
      name: "fither/dev-billing-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        receipt: state.receipt,
        trialCancelled: state.trialCancelled,
      }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useDevReceiptStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);

/** Resolves once the receipt store has settled (restore may run early). */
function receiptReady(): Promise<void> {
  const { hydrated, hydrationFailed } = useDevReceiptStore.getState();
  // Settled either way — a store already in the failed state will never
  // emit another change, so waiting on the subscription would hang.
  if (hydrated || hydrationFailed) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useDevReceiptStore.subscribe((state) => {
      if (state.hydrated || state.hydrationFailed) {
        unsubscribe();
        resolve();
      }
    });
  });
}

// Offerings as data: the two paywall plans (ADR-0014), annual first
// (annual led). Display strings are the USD reference fallbacks from
// strings.ts — the store adapter substitutes localised price labels.
const lifetimeOffering: Offering = {
  plan: "lifetime",
  priceLabel: strings.paywall.plans.lifetime.price,
  noteLabel: strings.paywall.plans.lifetime.note,
};

const offerings: readonly Offering[] = [
  {
    plan: "annual",
    priceLabel: strings.paywall.plans.annual.price,
    noteLabel: strings.paywall.plans.annual.note,
  },
  {
    plan: "monthly",
    priceLabel: strings.paywall.plans.monthly.price,
  },
];

export const devBilling: BillingPort = {
  async setUser(): Promise<void> {
    // No store customer in the dev adapter; nothing to tie.
  },
  async clearUser(): Promise<void> {
    // Nothing to forget.
  },
  getOfferings(): readonly Offering[] {
    return offerings;
  },

  getLifetimeOffering(): Offering | null {
    return lifetimeOffering;
  },

  getEntitlement(): PurchaseRecord | null {
    return useDevReceiptStore.getState().receipt;
  },

  async refreshEntitlement(): Promise<PurchaseRecord | null | undefined> {
    // No opinion: the dev "store" is consulted only through restore, so
    // the dev entitlement reset keeps meaning what it says.
    return undefined;
  },

  async lifetimeOfferEligible(): Promise<boolean> {
    await receiptReady();
    return useDevReceiptStore.getState().trialCancelled;
  },

  async purchase(plan: PlanId): Promise<PurchaseOutcome> {
    // Subscriptions start with the store's free week (ADR-0014 §6);
    // lifetime is paid at once.
    const purchase: PurchaseRecord =
      plan === "lifetime"
        ? { plan, date: todayIso() }
        : { plan, date: todayIso(), trial: true };
    await receiptReady();
    useDevReceiptStore.getState().setReceipt(purchase);
    return { ok: true, purchase };
  },

  async restore(): Promise<RestoreOutcome> {
    await receiptReady();
    const { receipt, hydrationFailed } = useDevReceiptStore.getState();
    if (hydrationFailed) return { ok: false, reason: "failed" };
    if (!receipt) return { ok: false, reason: "nothingToRestore" };
    return { ok: true, purchase: receipt };
  },
};
