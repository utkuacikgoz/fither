// The ONLY place an analytics event name or payload may be defined
// (fither-code "Ops stack"; ADR-0015). Four events, chosen to test the
// retention and conversion thesis and nothing else: did she arrive, did
// she start, did she finish, did she try. Every property is a closed
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
  /** A store trial began through the purchase sheet (ADR-0014 §6). */
  trial_start: { plan: "annual" | "monthly" };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

/** The four names, for tests and dashboards. */
export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = [
  "deep_link_open",
  "workout_start",
  "workout_complete",
  "trial_start",
];
