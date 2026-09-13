import { useEntitlementStore } from "../state/entitlement-store";
import type { FinishSummary } from "../state/session-store";
import { entitlementStatus } from "./entitlement";
import { freeSessionsAllowance } from "./experiment";

/**
 * The optional trial offer belongs only after the first proven session,
 * and only when that session has consumed this cohort's free allowance.
 */
export function firstCloseOfferDue(finish: FinishSummary | null): boolean {
  if (!finish?.first || !finish.completedAnything) return false;
  const { trialStartDate, purchase, trialUsed, qualifyingSessions } =
    useEntitlementStore.getState();
  return (
    entitlementStatus({
      firstCompletedDate: trialStartDate,
      purchase,
      trialUsed,
      qualifyingSessions,
      freeSessions: freeSessionsAllowance(),
    }) === "gated"
  );
}
