// Trial + entitlement policy (ADR-0009 §2–3 as amended by ADR-0014 §6 and
// ADR-0025). App-layer only — this is commercial policy, not training
// logic, and it must NEVER move into packages/engine. Pure functions over
// persisted state: evaluated offline, on device, no clock read.
//
// The free week is the STORE's introductory offer, started from the
// paywall ("Start my free week" purchases the plan she picked, with its
// 7 free days). The app keeps a count and two facts, and no calendar
// arithmetic: how many qualifying sessions she has completed (ADR-0025:
// a committed session with at least one completed block), how many are
// free before the gate (her experiment variant's allowance — one today,
// three under test), and whether the store currently entitles her (a
// purchase record, which a store trial is). "Expired" is the store's
// word too: it means an entitlement that was granted and then lapsed.
import type { PurchaseRecord } from "./billing";

export type EntitlementStatus =
  /** Free sessions still in hand and no entitlement ever held — nothing gates; she trains. */
  | "beforeTrial"
  /** The store entitles her: a trial in progress, or a paid plan. */
  | "purchased"
  /** The free sessions are used and no entitlement — the paywall, before any trial. */
  | "gated"
  /** An entitlement was held once and has lapsed. */
  | "trialExpired";

export function entitlementStatus(input: {
  /**
   * Local date of the first completed session, or null if none yet. Kept
   * for the trial stamp and the paywall's letter; a qualifying count above
   * zero always comes with a date.
   */
  firstCompletedDate: string | null;
  purchase: PurchaseRecord | null;
  /** An entitlement (trial or paid) was held at some point. */
  trialUsed: boolean;
  /** Committed sessions that carried the engine's "session" ledger event. */
  qualifyingSessions: number;
  /** How many qualifying sessions are free before the gate (1 or 3). */
  freeSessions: number;
}): EntitlementStatus {
  if (input.purchase) return "purchased";
  if (input.trialUsed) return "trialExpired";
  // A first-completed date with no count (a record written before the
  // count existed, or a crash between the two writes) is one consumed
  // session, never zero: an allowance is never handed back.
  const consumed = Math.max(input.qualifyingSessions, input.firstCompletedDate === null ? 0 : 1);
  return consumed < input.freeSessions ? "beforeTrial" : "gated";
}

/**
 * Whether generating a NEW session is allowed. Only the gated states
 * block — the paywall never blocks the first session, and history,
 * points, skills and settings stay reachable regardless.
 */
export function isEntitled(status: EntitlementStatus): boolean {
  return status === "beforeTrial" || status === "purchased";
}
