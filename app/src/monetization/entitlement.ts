// Trial + entitlement policy (ADR-0009 §2–3 as amended by ADR-0014 §6).
// App-layer only — this is commercial policy, not training logic, and it
// must NEVER move into packages/engine. Pure functions over persisted
// state: evaluated offline, on device, no clock read.
//
// The free week is the STORE's introductory offer, started from the
// paywall ("Start my free week" purchases the plan she picked, with its
// 7 free days). The app keeps two facts and no calendar arithmetic:
// whether a session has ever completed (the paywall never blocks the
// first session), and whether the store currently entitles her (a
// purchase record, which a store trial is). "Expired" is the store's
// word too: it means an entitlement that was granted and then lapsed.
import type { PurchaseRecord } from "./billing";

export type EntitlementStatus =
  /** No session ever completed — nothing gates; she trains first. */
  | "beforeTrial"
  /** The store entitles her: a trial in progress, or a paid plan. */
  | "purchased"
  /** A session completed and no entitlement — the paywall, before any trial. */
  | "gated"
  /** A session completed, an entitlement was held once and has lapsed. */
  | "trialExpired";

export function entitlementStatus(input: {
  /** Local date of the first completed session, or null if none yet. */
  firstCompletedDate: string | null;
  purchase: PurchaseRecord | null;
  /** An entitlement (trial or paid) was held at some point. */
  trialUsed: boolean;
}): EntitlementStatus {
  if (input.purchase) return "purchased";
  if (!input.firstCompletedDate) return "beforeTrial";
  return input.trialUsed ? "trialExpired" : "gated";
}

/**
 * Whether generating a NEW session is allowed. Only the gated states
 * block — the paywall never blocks the first session, and history,
 * points, skills and settings stay reachable regardless.
 */
export function isEntitled(status: EntitlementStatus): boolean {
  return status === "beforeTrial" || status === "purchased";
}
