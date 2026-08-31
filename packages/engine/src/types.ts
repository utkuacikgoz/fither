// The engine contract. UI renders what these types carry; it never
// re-derives a rule. Movement types mirror movement-schema.md; rule
// constants mirror engine-spec.md (ADR-0002/0003). Change spec and types
// together or not at all.

// ---------- Movement library (data/movements.json) ----------

export type Pattern = "push" | "pull" | "squat" | "hinge" | "core";
export type Tier = 1 | 2 | 3 | 4 | 5 | 6;
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
  cues: string[];
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
  /** Clean sessions at this tier. Advances at CLEAN_SESSIONS_TO_ADVANCE. */
  cleanStreak: number;
  /** Consecutive struggled/skipped sessions. Volume drops at 2, tier at 3. */
  struggledStreak: number;
  /** True while in the reduced-volume soft landing. */
  volumeReduced: boolean;
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
  | { kind: "tasteBlock"; pattern: Pattern; movementId: string };

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
   * soreness, quiet, energy, softLanding, staleFocus, taste.
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
 * streak (ADR-0002) AND at least this many calendar days since the tier
 * was reached (`tierSince`). Adaptation is time-bound, not session-bound;
 * the floor paces frequent and infrequent users nearly equally. Tier 6 is
 * terminal and has no floor. Cumulative minimum: tier 4 at day 49, tier 6
 * at day 147 (~week 21).
 */
export const DAYS_AT_TIER_TO_ADVANCE: Readonly<
  Record<Exclude<Tier, 6>, number>
> = { 1: 7, 2: 14, 3: 28, 4: 42, 5: 56 };

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
