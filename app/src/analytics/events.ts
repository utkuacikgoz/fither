// The ONLY place an analytics event name or payload may be defined
// (fither-code "Ops stack"; ADR-0015, extended by ADR-0024). The funnel
// the retention and conversion thesis needs and nothing else: did she
// arrive, get set up, see her session, start, finish, meet the gate,
// try. Every event names what the platform actually observed (a paywall
// shown, not a purchase considered). Every property is a closed
// union or a small number — the forbidden list (fither-domain) cannot
// even be represented here, and a test scans this directory for its
// words, comments included. Nothing identifying travels: no name, no
// email, no provider id, no query strings.

import type { SessionMinutes } from "@fither/engine";

/** Why a finished session closed — mirrors the store's FinishClose reasons. */
export type WorkoutCloseReason =
  | "completed"
  | "endedEarly"
  | "outOfTime"
  | "nothingDone";

export interface AnalyticsEvents {
  /** The app was opened through a link. Path only — never the query. */
  deep_link_open: { path: string };
  /** First launch of a fresh install reached the first decision screen (ADR-0024). */
  first_use_entry: Record<string, never>;
  /** Onboarding handed off to the daily prompt; which equipment she chose. */
  onboarding_complete: { equipment: "floor" | "chair" };
  /** A built session was shown on the preview. */
  session_preview: { minutes: SessionMinutes; blocks: number };
  /** She started moving: the player's first real transition. */
  workout_start: { minutes: SessionMinutes };
  /** A session was journaled and committed. */
  workout_complete: {
    minutes: SessionMinutes;
    close: WorkoutCloseReason;
    /** Her first ever completed session — the paywall stamp moment. */
    first: boolean;
    /** The day streak after this session committed (ADR-0018); 0 when nothing completed. */
    streak: number;
  };
  /** The paywall was shown: the gated day, the expired state, or Settings. */
  paywall_view: { surface: "gate" | "expired" | "settings" };
  /** An experiment assigned this phone a variant (ADR-0025); once per experiment. */
  experiment_exposure: { experiment: "free_sessions_v1"; variant: "control" | "three" };
  /** A store trial began through the purchase sheet (ADR-0014 §6). */
  trial_start: { plan: "annual" | "monthly" };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

/** Every name, in funnel order, for tests and dashboards. */
export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = [
  "deep_link_open",
  "first_use_entry",
  "onboarding_complete",
  "session_preview",
  "workout_start",
  "workout_complete",
  "paywall_view",
  "experiment_exposure",
  "trial_start",
];
