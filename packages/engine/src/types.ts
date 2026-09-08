// The engine contract. UI renders what these types carry; it never
// re-derives a rule. Movement types mirror movement-schema.md; rule
// constants mirror engine-spec.md (ADR-0002/0003). Change spec and types
// together or not at all.

// ---------- Movement library (data/movements.json) ----------

export type Pattern = "push" | "pull" | "squat" | "hinge" | "core";
export type Tier = 1 | 2 | 3 | 4 | 5 | 6;
/** The ladder's length, as a value: UI that shows "tier N of M" reads M
 * here rather than baking the number into copy. Tier 6 is terminal. */
export const MAX_TIER: Tier = 6;
export type Equipment = "none" | "chair" | "wall";
export type BodyArea =
  | "shoulders"
  | "wrists"
  | "elbows"
  | "back"
  | "hips"
  | "knees"
  | "ankles"
  | "core";

export interface MovementTiming {
  type: "reps" | "seconds";
  /** Rep count, or hold/work duration in seconds. */
  defaultValue: number;
  /** Required when type is "reps". */
  secondsPerRep?: number;
}

export interface Movement {
  id: string;
  name: string;
  pattern: Pattern;
  tier: Tier;
  /** Same pattern, exactly tier + 1. Null only at tier 6. */
  progressionTo: string | null;
  silent: boolean;
  equipment: Equipment;
  loads: BodyArea[];
  unilateral: boolean;
  timing: MovementTiming;
  /** Setup cues, read at the block intro (2-4). */
  cues: string[];
  /**
   * In-set corrections (1-3), the line she hears and sees DURING a set:
   * the movement's own failure mode, named as what to do. The engine
   * never reads these; they are display data joined at session creation
   * (owner decision 2026-09-08, "pointers on the movements").
   */
  inSetCues: string[];
}

export interface MovementLibrary {
  version: number;
  movements: Movement[];
}

// ---------- Daily prompt ----------

export type SessionMinutes = 10 | 20 | 30;
export type Energy = "low" | "okay" | "strong";

export interface DailyPrompt {
  minutes: SessionMinutes;
  energy: Energy;
  quiet: boolean;
  /** Sore / off-limits areas today. Empty array = "All good". */
  avoid: BodyArea[];
  /** Local calendar date, ISO yyyy-mm-dd. The engine never reads a clock. */
  date: string;
  /** Equipment available to the user (from settings). */
  equipment: Equipment[];
}

// ---------- Profile & history ----------

export interface PatternState {
  tier: Tier;
  // Naming note (S2 rename): these two counters are internal progression
  // bookkeeping — consecutive clean/struggled sessions at the current
  // tier. "Streak" is a forbidden-list-adjacent word this product never
  // wants near its vocabulary, even internally; "count" says what they
  // are. Hence cleanCount / struggleCount, never *Streak.
  /** Consecutive clean sessions at this tier. Advances at
   * CLEAN_SESSIONS_TO_ADVANCE. */
  cleanCount: number;
  /** Consecutive struggled sessions (skips are neutral, ADR-0012).
   * Volume drops at 2, tier at 3. */
  struggleCount: number;
  /** True while in the reduced-volume soft landing. */
  volumeReduced: boolean;
  /**
   * The highest tier the ORDINARY progression put this pattern at
   * (ADR-0026, owner decision 2026-09-08): the clean-count + time-floor
   * rule of ADR-0002/ADR-0008. It is not a ratchet: repeated struggle
   * may still take her ONE tier below it, exactly as ADR-0003 always
   * allowed (`regressionFloor` = `max(1, earnedTier - 1)`). What it
   * buys is that a tier starting-level calibration merely PLACED her at
   * was never earned, so correcting that placement downwards — all the
   * way back to this mark — is not taking something away, and does not
   * count as a regression in gate 2.
   *
   * Optional for legacy tolerance: a state persisted before this field
   * existed reads as `earnedTier = tier` (see `earnedTierOf`), so no
   * migration ever loses ground — an existing user's current tier is
   * already hers. Fresh profiles carry no stamp; the first applied
   * session stamps it, before any calibration placement.
   */
  earnedTier?: Tier;
  /**
   * ISO yyyy-mm-dd date the CURRENT tier was reached (ADR-0008). Set on
   * every tier change — advance and regress alike. Optional for legacy
   * tolerance: a state persisted before this field existed treats the
   * time floor as satisfied once and is stamped on its next applied
   * session; fresh profiles also start without it (the engine has no
   * clock), so a new user's tier-1 floor starts at her first session.
   */
  tierSince?: string;
}

/** A skill milestone reached at least once during the user's lifetime. */
export interface SkillMilestone {
  pattern: Pattern;
  tier: Tier;
}

export interface Profile {
  patterns: Record<Pattern, PatternState>;
  /**
   * Lifetime unlock memory (ADR-0007). Absence is accepted from profiles
   * persisted before this field existed and is treated as an empty list.
   */
  unlockedMilestones?: SkillMilestone[];
}

export type BlockOutcome = "completed" | "struggled" | "skipped";

export interface HistoryEntry {
  date: string;
  minutes: SessionMinutes;
  /** Outcome per block, same order as the generated session's blocks. */
  blocks: Array<{
    movementId: string;
    pattern: Pattern;
    outcome: BlockOutcome;
  }>;
}

export interface History {
  entries: HistoryEntry[];
}

// ---------- Adaptations (ADR-0006 — show the adaptation) ----------

/**
 * Why today's session looks the way it does. The engine emits a reason
 * only when the condition actually changed the generated session; the UI
 * maps kinds to plain-language lines in strings.ts and never re-derives.
 *
 * Deliberately absent: a "shortSession" kind. Ten minutes is complete
 * (ADR-0006) — session length is never framed as an adaptation.
 */
export type Adaptation =
  /** Avoid areas excluded at least one otherwise-eligible movement. */
  | { kind: "soreness"; areas: BodyArea[] }
  /** Quiet mode excluded at least one otherwise-eligible movement. */
  | { kind: "quiet" }
  /** Low energy reduced sets (same tier — never a tier drop). */
  | { kind: "lowEnergy" }
  /** Pattern is in the reduced-volume soft landing after regression. */
  | { kind: "softLanding"; pattern: Pattern }
  /** Session leads with this pattern because it has gone stale. */
  | { kind: "staleFocus"; pattern: Pattern }
  /** Strong energy earned a one-set taste of the next tier. */
  | { kind: "tasteBlock"; pattern: Pattern; movementId: string }
  /**
   * Starting-level calibration (ADR-0026): in the first two sessions of a
   * profile, every pattern is offered one set of the tier above its
   * current one, at any energy, right after that pattern's first block.
   * Progression- and points-neutral like every taste; unlike the
   * strong-energy `tasteBlock`, completing it cleanly raises where that
   * pattern STARTS next session (capped at CALIBRATION_MAX_TIER), which
   * is why the UI needs to tell the two apart — one is a bonus, the
   * other is the question "is this where you should start?". One
   * adaptation per offered taste.
   */
  | { kind: "calibrationTaste"; pattern: Pattern; movementId: string };

// ---------- Generated session ----------

export interface SessionBlock {
  movementId: string;
  pattern: Pattern;
  sets: number;
  /** Reps per set, or hold seconds per set, per the movement's timing type. */
  amount: number;
  restSeconds: number;
  estimatedSeconds: number;
  /** True when this block is a first taste of a newly reached tier. */
  atNewTier: boolean;
}

export interface Session {
  date: string;
  minutes: SessionMinutes;
  blocks: SessionBlock[];
  /** Must be <= minutes * 60. The sim gates on this. */
  estimatedTotalSeconds: number;
  seed: number;
  /**
   * Why today's session fits the prompt, ordered by importance:
   * soreness, quiet, energy, softLanding, staleFocus, taste,
   * calibrationTaste (one per pattern offered, in session order).
   * Required (ADR-0007). An empty list means today's answers did not alter
   * the generated prescription.
   */
  adaptations: Adaptation[];
}

// ---------- Applying results ----------

export interface SessionResult {
  session: Session;
  outcomes: BlockOutcome[];
}

export type LedgerEventType = "session" | "newTierBlock" | "skillUnlock";

export interface LedgerEvent {
  type: LedgerEventType;
  points: number;
  date: string;
  /** Pattern for tier/skill events; absent for plain session completion. */
  pattern?: Pattern;
  movementId?: string;
}

export interface ApplyResult {
  profile: Profile;
  history: History;
  /** Append-only. Points are only ever added (gamification.md). */
  ledgerEvents: LedgerEvent[];
  /** Skill unlocks earned by this session (tier milestones reached). */
  unlockedSkills: Array<{ pattern: Pattern; tier: Tier; movementName: string }>;
}

// ---------- Rule constants (ADR-0002 / ADR-0003 / ADR-0008) ----------

export const CLEAN_SESSIONS_TO_ADVANCE = 3;
export const STRUGGLED_SESSIONS_TO_REDUCE_VOLUME = 2;
export const STRUGGLED_SESSIONS_TO_REGRESS = 3;
export const MAX_PATTERN_ABSENCE_DAYS = 7;

/**
 * Time floor per ladder step (ADR-0008), keyed by the CURRENT tier (the
 * step's start). A pattern advances only when BOTH hold: the clean-session
 * count (ADR-0002) AND at least this many calendar days since the tier
 * was reached (`tierSince`). Adaptation is time-bound, not session-bound;
 * the floor paces frequent and infrequent users nearly equally. Tier 6 is
 * terminal and has no floor. Cumulative minimum: tier 4 at day 49, tier 6
 * at day 147 (~week 21).
 */
export const DAYS_AT_TIER_TO_ADVANCE: Readonly<
  Record<Exclude<Tier, 6>, number>
> = { 1: 7, 2: 14, 3: 28, 4: 42, 5: 56 };

/**
 * Starting-level calibration (ADR-0026, owner decisions 2026-09-08).
 *
 * A profile whose history holds fewer than this many sessions is still
 * calibrating: every pattern that gets a block is offered ONE set of the
 * next tier straight after it, at any energy. Two sessions — session one
 * can move a pattern to tier 2, session two to tier 3 — and never again.
 */
export const CALIBRATION_MAX_SESSIONS = 2;

/**
 * The highest tier calibration may hand out (owner answer 3: cap at 3,
 * not 4, even for push and squat). Above it, only the ordinary
 * clean-count + time-floor rule advances a pattern.
 */
export const CALIBRATION_MAX_TIER: Tier = 3;

/**
 * Points (ADR-0008, owner-revised): a completed session earns base 15
 * + 5 per ten minutes — 20/25/30 for 10/20/30. Showing up dominates and
 * "ten minutes is complete" caps the spread at 1.5x, while longer
 * sessions still visibly earn more. +5 per completed block at a newly
 * reached tier; +25 per skill unlock.
 */
export const POINTS = {
  perSessionByMinutes: { 10: 20, 20: 25, 30: 30 },
  perNewTierBlock: 5,
  perSkillUnlock: 25,
} as const;

// ---------- RNG ----------

/** Deterministic RNG in [0, 1). The engine never calls Math.random. */
export type Rng = () => number;
