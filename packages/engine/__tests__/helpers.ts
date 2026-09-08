import type {
  DailyPrompt,
  History,
  Movement,
  MovementLibrary,
  Pattern,
  Profile,
  Tier,
} from "../src/index.js";
import { createInitialProfile, PATTERNS } from "../src/index.js";
import movementsJson from "../../../data/movements.json";

/** The real bundled movement library, as the app would pass it in. */
export const realLibrary = movementsJson as unknown as MovementLibrary;

/** A tiny synthetic library for constraint-filter tests: one 2-tier ladder
 * per pattern, with deliberately loud / chair-only variants at tier 1. */
export function syntheticLibrary(): MovementLibrary {
  const movements: Movement[] = [];
  for (const pattern of PATTERNS) {
    movements.push(
      {
        id: `${pattern}-quiet-1`,
        name: `${pattern} quiet 1`,
        pattern,
        tier: 1,
        progressionTo: `${pattern}-quiet-2`,
        silent: true,
        equipment: "none",
        loads: ["hips"],
        unilateral: false,
        timing: { type: "reps", defaultValue: 8, secondsPerRep: 4 },
        cues: ["a", "b"],
        inSetCues: ["Keep breathing"],
      },
      {
        id: `${pattern}-loud-1`,
        name: `${pattern} loud 1`,
        pattern,
        tier: 1,
        progressionTo: `${pattern}-quiet-2`,
        silent: false,
        equipment: "none",
        loads: ["knees"],
        unilateral: false,
        timing: { type: "reps", defaultValue: 8, secondsPerRep: 4 },
        cues: ["a", "b"],
        inSetCues: ["Keep breathing"],
      },
      {
        id: `${pattern}-chair-1`,
        name: `${pattern} chair 1`,
        pattern,
        tier: 1,
        progressionTo: `${pattern}-quiet-2`,
        silent: true,
        equipment: "chair",
        loads: ["shoulders"],
        unilateral: false,
        timing: { type: "seconds", defaultValue: 20 },
        cues: ["a", "b"],
        inSetCues: ["Keep breathing"],
      },
      {
        id: `${pattern}-quiet-2`,
        name: `${pattern} quiet 2`,
        pattern,
        tier: 2,
        progressionTo: null,
        silent: true,
        equipment: "none",
        loads: ["hips"],
        unilateral: false,
        timing: { type: "reps", defaultValue: 8, secondsPerRep: 4 },
        cues: ["a", "b"],
        inSetCues: ["Keep breathing"],
      },
    );
  }
  return { version: 1, movements };
}

export function prompt(overrides: Partial<DailyPrompt> = {}): DailyPrompt {
  return {
    minutes: 20,
    energy: "okay",
    quiet: false,
    avoid: [],
    date: "2026-02-02",
    equipment: ["chair"],
    ...overrides,
  };
}

export function profileAtTier(tier: Tier): Profile {
  const p = createInitialProfile();
  for (const pattern of PATTERNS) p.patterns[pattern].tier = tier;
  return p;
}

/**
 * A profile standing at `tier` on every pattern with the earned mark
 * still at `earned` — the state starting-level calibration leaves behind
 * (ADR-0026): placed, not earned, so a regression may correct it back
 * down to `earned`. `profileAtTier` leaves `earnedTier` unset, which
 * reads as the CURRENT tier, so its regression floor is one tier below
 * where it stands (`regressionFloor`, narrowed 2026-09-08).
 */
export function profilePlacedAtTier(tier: Tier, earned: Tier = 1): Profile {
  const p = profileAtTier(tier);
  for (const pattern of PATTERNS) p.patterns[pattern].earnedTier = earned;
  return p;
}

export const emptyHistory: History = { entries: [] };

export function historyWithPatterns(patternsPerEntry: Pattern[][]): History {
  return {
    entries: patternsPerEntry.map((patterns, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      minutes: 20,
      blocks: patterns.map((pattern) => ({
        movementId: `${pattern}-quiet-1`,
        pattern,
        outcome: "completed" as const,
      })),
    })),
  };
}

/**
 * A history long enough that starting-level calibration is over
 * (ADR-0026): the engine offers calibration tastes only while fewer than
 * CALIBRATION_MAX_SESSIONS sessions are on record. Every pattern appears
 * in every entry, so nothing is stale either — the session under test is
 * an ordinary one.
 */
export const settledHistory: History = historyWithPatterns([
  [...PATTERNS],
  [...PATTERNS],
]);
