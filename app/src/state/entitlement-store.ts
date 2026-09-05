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
   * Local date of the FIRST completed session. Stamped exactly once by
   * completeSession; the paywall never blocks the first session
   * (ADR-0009 §2). The persisted key keeps its historical name: under
   * ADR-0014 §6 the free week is the store's, and this date only says
   * "she has trained once" — the gate opens after it.
   */
  trialStartDate: string | null;
  /** The granted purchase, if any. Written only via the billing port. */
  purchase: PurchaseRecord | null;
  /**
   * An entitlement was held at some point (a store trial counts). Once
   * true it stays true: a lapsed trial shows the paywall's expired
   * letter, never a second "free week ahead" promise.
   */
  trialUsed: boolean;
  /**
   * Ask the store for its current word and adopt it: grant, or revoke a
   * lapsed one. No opinion (dev adapter, offline) changes nothing — the
   * app-side record stands, so airplane mode never locks her out.
   */
  refreshFromStore: () => Promise<void>;
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
      trialUsed: false,
      hydrated: false,
      hydrationFailed: false,

      refreshFromStore: async () => {
        const record = await getBilling().refreshEntitlement();
        if (record === undefined) return;
        set((state) => ({
          purchase: record,
          trialUsed: state.trialUsed || record !== null,
        }));
      },

      markSessionCompleted: (date) => {
        if (get().trialStartDate !== null) return;
        set({ trialStartDate: date });
      },

      purchasePlan: async (plan) => {
        const outcome = await getBilling().purchase(plan);
        if (!outcome.ok) return outcome.reason;
        set({ purchase: outcome.purchase, trialUsed: true });
        return "purchased";
      },

      restorePurchases: async () => {
        const outcome = await getBilling().restore();
        if (!outcome.ok) {
          return outcome.reason === "nothingToRestore" ? "empty" : "failed";
        }
        set({ purchase: outcome.purchase, trialUsed: true });
        return "restored";
      },

      resetForDev: () => set({ trialStartDate: null, purchase: null, trialUsed: false }),
    }),
    {
      name: "fither/entitlement-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        trialStartDate: state.trialStartDate,
        purchase: state.purchase,
        trialUsed: state.trialUsed,
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
