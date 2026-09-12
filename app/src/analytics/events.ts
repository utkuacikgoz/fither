// The ONLY place an analytics event name or payload may be defined
// (fither-code "Ops stack"; ADR-0015, extended by ADR-0024). The funnel
// the retention and conversion thesis needs and nothing else: did she
// arrive, get set up, see her session, start, finish, meet the gate,
// try — and, since the drop-off pass (owner decision 2026-09-08), every
// step she can leave from: each prompt answer, each block inside a
// session, each choice on the paywall, each permission ask. Every event
// names what the platform actually observed (a paywall shown, not a
// purchase considered). Every property is a closed union or a small
// number — the forbidden list (fither-domain) cannot even be
// represented here, and a test scans this directory for its words,
// comments included. Nothing identifying travels: no name, no email,
// no query strings, and never the provider id itself — when she signs
// in with Apple the analytics person becomes a one-way hash of that id
// (analytics/identity.ts), so she counts once across devices and the
// id stays on the phone.

import type { Energy, Pattern, SessionMinutes } from "@fither/engine";

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
  /** She set a weekly intention (wave 2); none = no target. */
  weekly_intention_set: { target: "two" | "three" | "none" };
  /** A weekly recap was opened, and the surface that led to it. */
  weekly_recap_view: { source: "home" | "settings" | "link" };
  /** A share was offered on a surface (wave 3). */
  share_eligible: { source: "finish" | "receipt" | "recap" };
  /** She opened the share sheet; iOS reports nothing after this. */
  share_start: { source: "finish" | "receipt" | "recap"; context: "home" | "hotel" | "meetings" | "none" };
  /** The paywall was shown: the gated day, the expired state, or Settings. */
  paywall_view: { surface: "gate" | "expired" | "settings" };
  /** The app opened from a shared scenario link (ADR-0024 §3); the allowlisted id only. */
  scenario_entry: { scenario: ScenarioId };
  /** An experiment assigned this phone a variant (ADR-0025); once per experiment. */
  experiment_exposure: { experiment: "free_sessions_v1"; variant: "control" | "three" };
  /** A store trial began through the purchase sheet (ADR-0014 §6). */
  trial_start: { plan: "annual" | "monthly" };

  // ---- Drop-off pass (2026-09-08): where she leaves, step by step ----

  /** The sign-in frame was shown (first use, or after sign-out). */
  sign_in_view: Record<string, never>;
  /** How the frame ended: the provider sheet's outcome, or the guest path. */
  sign_in_result: { method: "apple" | "guest"; outcome: "done" | "cancelled" | "failed" };
  /** One daily-prompt answer given; the four steps in order make the prompt funnel. */
  prompt_answer:
    | { step: "time"; minutes: SessionMinutes }
    | { step: "energy"; energy: Energy }
    | { step: "quiet"; quiet: boolean }
    | { step: "soreness"; areas: number };
  /** The engine could not build around today's answers; how many areas, how many single set-asides would unblock. */
  no_session_shown: { areas: number; unblocking: number };
  /** What she did on the dead end. */
  no_session_action: { action: "setAside" | "changeAnswers" };
  /** The care beat closed: a note kept on the phone, or skipped. Never the note. */
  care_note: { saved: boolean };
  /** She left the preview without starting. */
  preview_leave: { action: "changeAnswers" };
  /** The one-time voice ask was answered. */
  voice_ask: { voice: boolean };
  /** A block concluded inside the player: where in the session, and how. */
  block_outcome: { index: number; total: number; outcome: "completed" | "struggled" | "skipped" };
  /** A named skill was reached (the unlock screen). */
  skill_unlocked: { pattern: Pattern; tier: number };
  /** The reminder ask was answered; osDenied = she said yes and iOS said no. */
  reminder_ask: { outcome: "allow" | "decline" | "osDenied" };
  /** A plan row was tapped on the paywall. */
  paywall_plan: { plan: "annual" | "monthly" };
  /** She left the paywall without buying, where leaving is possible. */
  paywall_leave: { surface: "gate" | "expired" | "settings" };
  /** The purchase sheet's outcome, any plan. */
  purchase_result: { plan: "annual" | "monthly" | "lifetime"; outcome: "purchased" | "cancelled" | "failed" };
  /** Restore purchases, from the paywall or Settings. */
  restore_result: { outcome: "restored" | "empty" | "failed" };
  /** The day-3 lifetime offer was shown, or declined. */
  lifetime_offer: { action: "view" | "decline" };
  /** The iOS share sheet closed; completed = she picked a destination. */
  share_complete: { completed: boolean };
  /** She signed out or erased everything: the churn signals. */
  account_action: { action: "signOut" | "erase" };
}

/**
 * Facts about the person, not moments (PostHog person properties).
 * Set whole, never merged with guesses; each is a closed value.
 */
export interface PersonProperties {
  entitlement: "free" | "trial" | "active" | "lapsed";
  /** Completed sessions, ever. */
  sessions_completed: number;
  /** The length she chose last. */
  last_minutes: SessionMinutes | null;
  intention: "two" | "three" | "none";
  voice: boolean;
  signed_in: boolean;
}

/** The public scenario ids a shared link may carry; anything else is dropped. */
export const SCENARIO_IDS = [
  "friends_week",
  "between_meetings",
  "away_from_home",
  "quiet_house",
  "session",
  "week",
] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export type AnalyticsEventName = keyof AnalyticsEvents;

/** Every name, in funnel order, for tests and dashboards. */
export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = [
  "deep_link_open",
  "first_use_entry",
  "onboarding_complete",
  "session_preview",
  "workout_start",
  "workout_complete",
  "weekly_intention_set",
  "weekly_recap_view",
  "share_eligible",
  "share_start",
  "paywall_view",
  "scenario_entry",
  "experiment_exposure",
  "trial_start",
  "sign_in_view",
  "sign_in_result",
  "prompt_answer",
  "no_session_shown",
  "no_session_action",
  "care_note",
  "preview_leave",
  "voice_ask",
  "block_outcome",
  "skill_unlocked",
  "reminder_ask",
  "paywall_plan",
  "paywall_leave",
  "purchase_result",
  "restore_result",
  "lifetime_offer",
  "share_complete",
  "account_action",
];
