// The app-side entitlement record (ADR-0009). Canonical for gating and
// evaluated fully offline — a paying user in airplane mode is never
// locked out. Billing writes land here only through the billing port; the
// trial stamp lands here only from the session-completion flow. The
// policy itself (what these dates mean) lives in monetization/entitlement.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getBilling, type PlanId, type PurchaseRecord } from "../monetization/billing";

interface EntitlementStoreState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /**
   * Local date of the FIRST completed session — the trial start
   * (ADR-0009 §2). Stamped exactly once by completeSession; an unused
   * install spends no trial.
   */
  trialStartDate: string | null;
  /** The granted purchase, if any. Written only via the billing port. */
  purchase: PurchaseRecord | null;
  /** Stamp the trial start. Idempotent: only the first call sticks. */
  markSessionCompleted: (date: string) => void;
  /** Buy through the billing port and persist the grant. */
  purchasePlan: (plan: PlanId) => Promise<boolean>;
  /** Restore through the billing port; true iff a purchase came back. */
  restorePurchases: () => Promise<boolean>;
  /**
   * DEV-ONLY reset for testing paywall flows: clears the app-side trial
   * and purchase. Deliberately does NOT touch dev-billing's fake receipt,
   * so the restore path stays exercisable — exactly like real life, where
   * the store still knows you paid.
   */
  resetForDev: () => void;
}

export const useEntitlementStore = create<EntitlementStoreState>()(
  persist(
    (set, get) => ({
      trialStartDate: null,
      purchase: null,
      hydrated: false,
      hydrationFailed: false,

      markSessionCompleted: (date) => {
        if (get().trialStartDate !== null) return;
        set({ trialStartDate: date });
      },

      purchasePlan: async (plan) => {
        const outcome = await getBilling().purchase(plan);
        if (!outcome.ok) return false;
        set({ purchase: outcome.purchase });
        return true;
      },

      restorePurchases: async () => {
        const outcome = await getBilling().restore();
        if (!outcome.ok) return false;
        set({ purchase: outcome.purchase });
        return true;
      },

      resetForDev: () => set({ trialStartDate: null, purchase: null }),
    }),
    {
      name: "fither/entitlement-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        trialStartDate: state.trialStartDate,
        purchase: state.purchase,
      }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useEntitlementStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);
