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
  SKILL_MILESTONE_TIERS,
} from "./apply";
export { createInitialProfile, PATTERNS } from "./profile";
