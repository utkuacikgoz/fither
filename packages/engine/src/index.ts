// Public surface of @fither/engine. Implementation lives in sibling
// modules (engine-engineer's surface); the contract lives in types.ts.

export * from "./types";
export { createRng } from "./rng";
export {
  generateSession,
  trainingDaysSincePattern,
  TRANSITION_SECONDS,
  DEFAULT_REST_SECONDS,
  MAX_REST_SECONDS,
  BASE_SETS,
  REDUCED_SETS,
  MIN_SETS,
  TARGET_UTILIZATION,
  TASTE_RESERVE_SECONDS,
  STALE_FOCUS_MIN_TRAINING_DAYS,
} from "./generate";
export {
  applySessionResult,
  calendarDaysBetween,
  milestoneMovement,
  nextMilestone,
  tiersToMilestone,
  SKILL_MILESTONE_TIERS,
} from "./apply";
export { createInitialProfile, PATTERNS } from "./profile";
export { computeStreak, type StreakState } from "./streak";
export {
  trainedDay,
  weekOf,
  weekParticipation,
  weeklyIntentionMet,
  weeksParticipation,
  type Week,
  type WeekParticipation,
  type WeeklyTarget,
} from "./week";
export { unblockingAreas } from "./unblocking";
