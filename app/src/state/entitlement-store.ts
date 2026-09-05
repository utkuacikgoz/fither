// The app-side entitlement record (ADR-0009). Canonical for gating and
// evaluated fully offline — a paying user in airplane mode is never
// locked out. Billing writes land here only through the billing port; the
// trial stamp lands here only from the session-completion flow. The
// policy itself (what these dates mean) lives in monetization/entitlement.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getBilling, type PlanId, type PurchaseRecord } from "../monetization/billing";

/**
 * What a restore attempt meant, in the screen's terms: "restored" granted
 * an entitlement; "empty" completed fine but found no purchase on this
 * account (not an error — she may simply be new); "failed" is an actual
 * failure worth retrying.
 */
export type RestoreResult = "restored" | "empty" | "failed";

/** What a purchase attempt meant: granted, she closed the sheet, or the process failed. */
export type PurchaseResult = "purchased" | "cancelled" | "failed";

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
  purchasePlan: (plan: PlanId) => Promise<PurchaseResult>;
  /** Restore through the billing port; grants only on "restored". */
  restorePurchases: () => Promise<RestoreResult>;
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
        if (!outcome.ok) return outcome.reason;
        set({ purchase: outcome.purchase });
        return "purchased";
      },

      restorePurchases: async () => {
        const outcome = await getBilling().restore();
        if (!outcome.ok) {
          return outcome.reason === "nothingToRestore" ? "empty" : "failed";
        }
        set({ purchase: outcome.purchase });
        return "restored";
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
