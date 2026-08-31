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
}

export interface Profile {
  patterns: Record<Pattern, PatternState>;
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

// ---------- Rule constants (ADR-0002 / ADR-0003) ----------

export const CLEAN_SESSIONS_TO_ADVANCE = 3;
export const STRUGGLED_SESSIONS_TO_REDUCE_VOLUME = 2;
export const STRUGGLED_SESSIONS_TO_REGRESS = 3;
export const MAX_PATTERN_ABSENCE_DAYS = 7;

/** Points: 1 per minute; +5 per block at a newly reached tier; +25 per skill unlock. */
export const POINTS = {
  perSessionMinute: 1,
  perNewTierBlock: 5,
  perSkillUnlock: 25,
} as const;

// ---------- RNG ----------

/** Deterministic RNG in [0, 1). The engine never calls Math.random. */
export type Rng = () => number;
