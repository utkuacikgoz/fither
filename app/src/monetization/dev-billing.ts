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
}

export const useDevReceiptStore = create<DevReceiptState>()(
  persist(
    (set) => ({
      receipt: null,
      hydrated: false,
      hydrationFailed: false,
      setReceipt: (receipt) => set({ receipt }),
    }),
    {
      name: "fither/dev-billing-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ receipt: state.receipt }),
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

// Offerings as data: the two ADR-0002 plans, annual first (annual led).
// Display strings are the GBP reference fallbacks from strings.ts — a
// real adapter substitutes the provider's localised price labels.
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
  getOfferings(): readonly Offering[] {
    return offerings;
  },

  getEntitlement(): PurchaseRecord | null {
    return useDevReceiptStore.getState().receipt;
  },

  async purchase(plan: PlanId): Promise<PurchaseOutcome> {
    const purchase: PurchaseRecord = { plan, date: todayIso() };
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
