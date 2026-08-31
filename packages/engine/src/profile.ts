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
  // No tierSince stamp (ADR-0008): the engine has no clock, so a fresh
  // profile cannot know "today". The legacy-tolerance rule in apply.ts
  // doubles as the fresh-profile rule: the first applied session stamps
  // tierSince, and the tier-1 time floor runs from that first session.
  return { tier: 1, cleanStreak: 0, struggledStreak: 0, volumeReduced: false };
}

/** A brand-new user: tier 1 everywhere, no streaks, nothing unlocked. */
export function createInitialProfile(): Profile {
  return {
    patterns: {
      push: freshPatternState(),
      pull: freshPatternState(),
      squat: freshPatternState(),
      hinge: freshPatternState(),
      core: freshPatternState(),
    },
    unlockedMilestones: [],
  };
}
