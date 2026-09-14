// The app-side entitlement record (ADR-0009). Canonical for gating and
// evaluated fully offline — a paying user in airplane mode is never
// locked out. Billing writes land here only through the billing port; the
// qualifying-session count and the trial stamp land here only from the
// session-completion flow. The policy itself (what these facts mean)
// lives in monetization/entitlement.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { track } from "../analytics/analytics";
import { haptic } from "../haptics/haptics";
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

/** The shape written to disk (partialize) and read back (merge). */
interface PersistedEntitlement {
  trialStartDate: string | null;
  purchase: PurchaseRecord | null;
  trialUsed: boolean;
  qualifyingSessions: number;
  lastQualifyingSessionId: string | null;
}

interface EntitlementStoreState extends PersistedEntitlement {
  hydrated: boolean;
  hydrationFailed: boolean;
  /**
   * Local date of the FIRST completed session. Stamped exactly once by
   * recordQualifyingSession; the paywall never blocks the first session
   * (ADR-0009 §2). The persisted key keeps its historical name: under
   * ADR-0014 §6 the free week is the store's, and this date only says
   * "she has trained once" — the paywall's letter reads it.
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
   * How many qualifying sessions have been committed (ADR-0025): a
   * session whose engine result carried the "session" ledger event — the
   * same fact that stamps trialStartDate. Compared with the experiment's
   * allowance by the policy; never reset except by the dev reset.
   */
  qualifyingSessions: number;
  /**
   * The session id the count last moved for. The completion journal can
   * replay one record after a crash; the same id counts once.
   */
  lastQualifyingSessionId: string | null;
  /**
   * Ask the store for its current word and adopt it: grant, or revoke a
   * lapsed one. No opinion (dev adapter, offline) changes nothing — the
   * app-side record stands, so airplane mode never locks her out.
   */
  refreshFromStore: () => Promise<void>;
  /**
   * Count one qualifying session and stamp the first completed date if
   * none is set. Idempotent per session id: a journal replay of the same
   * committed record changes nothing. Called by the session store after
   * its commit, only for a result that carried the "session" event.
   */
  recordQualifyingSession: (sessionId: string, date: string) => void;
  /** Buy through the billing port and persist the grant. */
  purchasePlan: (plan: PlanId) => Promise<PurchaseResult>;
  /** Restore through the billing port; grants only on "restored". */
  restorePurchases: () => Promise<RestoreResult>;
  /**
   * DEV-ONLY reset for testing paywall flows: clears the app-side trial,
   * count and purchase. Deliberately does NOT touch dev-billing's fake
   * receipt, so the restore path stays exercisable — exactly like real
   * life, where the store still knows you paid.
   */
  resetForDev: () => void;
}

/**
 * Pre-experiment records (ADR-0025 migration): a record with the first
 * completed date stamped and no count has spent exactly one qualifying
 * session — the one the stamp came from. A consumed allowance is never
 * reset; purchase and trialUsed are read back as they are.
 */
export function migrateEntitlement(
  persisted: Partial<PersistedEntitlement> | undefined,
): Partial<PersistedEntitlement> {
  if (!persisted) return {};
  if (typeof persisted.qualifyingSessions === "number") return persisted;
  return {
    ...persisted,
    qualifyingSessions: persisted.trialStartDate ? 1 : 0,
  };
}

export const useEntitlementStore = create<EntitlementStoreState>()(
  persist(
    (set, get) => ({
      trialStartDate: null,
      purchase: null,
      trialUsed: false,
      qualifyingSessions: 0,
      lastQualifyingSessionId: null,
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

      recordQualifyingSession: (sessionId, date) => {
        const { lastQualifyingSessionId, qualifyingSessions, trialStartDate } = get();
        if (lastQualifyingSessionId === sessionId) return;
        set({
          qualifyingSessions: qualifyingSessions + 1,
          lastQualifyingSessionId: sessionId,
          trialStartDate: trialStartDate ?? date,
        });
      },

      purchasePlan: async (plan) => {
        const outcome = await getBilling().purchase(plan);
        // purchase_result: the sheet's own word, any plan — the plan she
        // asked for, since a refused sheet grants none.
        track("purchase_result", {
          plan,
          outcome: outcome.ok ? "purchased" : outcome.reason,
        });
        if (!outcome.ok) return outcome.reason;
        set({ purchase: outcome.purchase, trialUsed: true });
        // The grant is felt here, once, whichever screen asked (ADR-0030).
        haptic("success");
        // trial_start: the store granted a free period on a subscription
        // (ADR-0014 §6). A straight purchase or the lifetime plan is not
        // a trial and sends nothing here.
        if (outcome.purchase.trial && outcome.purchase.plan !== "lifetime") {
          track("trial_start", { plan: outcome.purchase.plan });
        }
        return "purchased";
      },

      restorePurchases: async () => {
        const outcome = await getBilling().restore();
        const result: RestoreResult = outcome.ok
          ? "restored"
          : outcome.reason === "nothingToRestore"
            ? "empty"
            : "failed";
        track("restore_result", { outcome: result });
        if (!outcome.ok) return result;
        set({ purchase: outcome.purchase, trialUsed: true });
        haptic("success");
        return result;
      },

      resetForDev: () =>
        set({
          trialStartDate: null,
          purchase: null,
          trialUsed: false,
          qualifyingSessions: 0,
          lastQualifyingSessionId: null,
        }),
    }),
    {
      name: "fither/entitlement-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): PersistedEntitlement => ({
        trialStartDate: state.trialStartDate,
        purchase: state.purchase,
        trialUsed: state.trialUsed,
        qualifyingSessions: state.qualifyingSessions,
        lastQualifyingSessionId: state.lastQualifyingSessionId,
      }),
      // The migration runs on every read rather than by version number:
      // the completion journal writes this key too, and its canonical
      // write carries no version — a record it wrote before the count
      // existed must still read as one spent session.
      merge: (persisted, current) => ({
        ...current,
        ...migrateEntitlement(persisted as Partial<PersistedEntitlement> | undefined),
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
