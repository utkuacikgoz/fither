import type { Pattern, PatternState, Profile } from "./types.js";

/** Canonical pattern order (ADR-0002). Used for deterministic tie-breaks. */
export const PATTERNS: readonly Pattern[] = [
  "push",
  "pull",
  "squat",
  "hinge",
  "core",
] as const;

function freshPatternState(): PatternState {
  return { tier: 1, cleanStreak: 0, struggledStreak: 0, volumeReduced: false };
}

/** A brand-new user: tier 1 everywhere, no streaks. */
export function createInitialProfile(): Profile {
  return {
    patterns: {
      push: freshPatternState(),
      pull: freshPatternState(),
      squat: freshPatternState(),
      hinge: freshPatternState(),
      core: freshPatternState(),
    },
  };
}
