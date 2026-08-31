// Trial + entitlement policy (ADR-0009 §2–3). App-layer only — this is
// commercial policy, not training logic, and it must NEVER move into
// packages/engine. Pure functions over persisted dates: evaluated offline,
// on device, with the same local-date source as the daily prompt
// (todayIso — the caller passes the date in, this module reads no clock).

import type { PurchaseRecord } from "./billing";

/** ADR-0002: 7-day free trial, starting at the first COMPLETED session. */
export const TRIAL_DAYS = 7;

export type EntitlementStatus =
  /** No session ever completed — the trial has not begun and nothing gates. */
  | "beforeTrial"
  | "trialActive"
  | "trialExpired"
  | "purchased";

/** Whole calendar days from `fromIso` to `toIso` (both local yyyy-mm-dd). */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function entitlementStatus(input: {
  /** Local date of the first completed session, or null if none yet. */
  trialStartDate: string | null;
  purchase: PurchaseRecord | null;
  /** Today's local date (todayIso()). */
  today: string;
}): EntitlementStatus {
  if (input.purchase) return "purchased";
  if (!input.trialStartDate) return "beforeTrial";
  // Day of the first completed session counts as day 0; day 7 is the
  // first gated day. A clock moved backwards (negative day count) is
  // treated as active — clock weirdness never locks her out.
  const day = daysBetweenIso(input.trialStartDate, input.today);
  return day < TRIAL_DAYS ? "trialActive" : "trialExpired";
}

/**
 * Whether generating a NEW session is allowed. Only an expired,
 * unpurchased trial gates — the paywall never blocks the first session,
 * and history/points/skills/settings stay reachable regardless.
 */
export function isEntitled(status: EntitlementStatus): boolean {
  return status !== "trialExpired";
}
