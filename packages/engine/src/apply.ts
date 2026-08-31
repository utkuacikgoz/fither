import type {
  ApplyResult,
  History,
  LedgerEvent,
  Movement,
  MovementLibrary,
  Pattern,
  PatternState,
  Profile,
  SessionResult,
  Tier,
} from "./types.js";
import {
  CLEAN_SESSIONS_TO_ADVANCE,
  POINTS,
  STRUGGLED_SESSIONS_TO_REDUCE_VOLUME,
  STRUGGLED_SESSIONS_TO_REGRESS,
} from "./types.js";
import { PATTERNS } from "./profile.js";

/**
 * Tiers whose arrival unlocks a named skill (PROPOSED: mid-ladder capability
 * milestone and mastery). The skill name is the canonical ladder movement at
 * that tier — e.g. push tier 4 → "Full Push-Up".
 */
export const SKILL_MILESTONE_TIERS: readonly Tier[] = [4, 6] as const;

/** First movement in library order at (pattern, tier) — the canonical ladder step. */
export function milestoneMovement(
  library: MovementLibrary,
  pattern: Pattern,
  tier: Tier,
): Movement | null {
  return (
    library.movements.find((m) => m.pattern === pattern && m.tier === tier) ??
    null
  );
}

export function applySessionResult(
  library: MovementLibrary,
  profile: Profile,
  history: History,
  result: SessionResult,
): ApplyResult {
  const { session, outcomes } = result;
  const byId = new Map(library.movements.map((m) => [m.id, m]));

  // Zero-block generation is a first-class "couldn't build" outcome.
  // It changes no profile state, earns nothing, and never inflates history
  // or pattern staleness (ADR-0007).
  if (session.blocks.length === 0) {
    return {
      profile,
      history,
      ledgerEvents: [],
      unlockedSkills: [],
    };
  }

  // Per-pattern verdict at the CURRENT tier. Taste blocks above it and
  // constraint fallbacks below it are both neutral (ADR-0007).
  const seen = new Set<Pattern>();
  const struggled = new Set<Pattern>();
  session.blocks.forEach((block, i) => {
    const movement = byId.get(block.movementId);
    const state = profile.patterns[block.pattern];
    if (!movement || movement.tier !== state.tier) return;
    seen.add(block.pattern);
    if (outcomes[i] !== "completed") struggled.add(block.pattern);
  });

  const ledgerEvents: LedgerEvent[] = [];
  const unlockedSkills: ApplyResult["unlockedSkills"] = [];

  // Session completion points: 1/minute (10/20/30). Requires at least one
  // completed block (PROPOSED) — a fully skipped session earns nothing,
  // but nothing is ever deducted either.
  if (outcomes.some((o) => o === "completed")) {
    ledgerEvents.push({
      type: "session",
      points: session.minutes * POINTS.perSessionMinute,
      date: session.date,
    });
  }

  // New-tier block bonuses: +5 per completed, current-tier block flagged
  // atNewTier. The tier check makes the points rule robust to malformed or
  // legacy taste/fallback flags.
  session.blocks.forEach((block, i) => {
    const movement = byId.get(block.movementId);
    if (
      block.atNewTier &&
      outcomes[i] === "completed" &&
      movement?.tier === profile.patterns[block.pattern].tier
    ) {
      ledgerEvents.push({
        type: "newTierBlock",
        points: POINTS.perNewTierBlock,
        date: session.date,
        pattern: block.pattern,
        movementId: block.movementId,
      });
    }
  });

  // Progression state machine (ADR-0002/0003). Absence NEVER regresses:
  // patterns not in this session keep their state untouched.
  const nextPatterns = { ...profile.patterns };
  const unlockedMilestones = [...(profile.unlockedMilestones ?? [])];
  for (const pattern of PATTERNS) {
    if (!seen.has(pattern)) continue;
    const prev = nextPatterns[pattern];
    const next: PatternState = { ...prev };

    if (struggled.has(pattern)) {
      next.cleanStreak = 0;
      next.struggledStreak = prev.struggledStreak + 1;
      if (next.struggledStreak >= STRUGGLED_SESSIONS_TO_REGRESS) {
        // Third consecutive struggle: drop one tier, land softly
        // (volume-reduced) with fresh counters.
        next.tier = Math.max(1, prev.tier - 1) as Tier;
        next.struggledStreak = 0;
        next.volumeReduced = true;
      } else if (next.struggledStreak >= STRUGGLED_SESSIONS_TO_REDUCE_VOLUME) {
        next.volumeReduced = true;
      }
    } else {
      // Clean session: any clean session resets the struggle counter and
      // ends the volume-reduced soft landing.
      next.struggledStreak = 0;
      next.volumeReduced = false;
      next.cleanStreak = prev.cleanStreak + 1;
      if (next.cleanStreak >= CLEAN_SESSIONS_TO_ADVANCE && prev.tier < 6) {
        next.tier = (prev.tier + 1) as Tier;
        next.cleanStreak = 0;
        const alreadyUnlocked = unlockedMilestones.some(
          (milestone) =>
            milestone.pattern === pattern && milestone.tier === next.tier,
        );
        if (SKILL_MILESTONE_TIERS.includes(next.tier) && !alreadyUnlocked) {
          const movement = milestoneMovement(library, pattern, next.tier);
          if (movement) {
            unlockedMilestones.push({ pattern, tier: next.tier });
            unlockedSkills.push({
              pattern,
              tier: next.tier,
              movementName: movement.name,
            });
            ledgerEvents.push({
              type: "skillUnlock",
              points: POINTS.perSkillUnlock,
              date: session.date,
              pattern,
              movementId: movement.id,
            });
          }
        }
      }
      // Tier 6 is terminal: cleanStreak keeps counting, tier never changes.
    }
    nextPatterns[pattern] = next;
  }

  // History is append-only; inputs are never mutated.
  const entry = {
    date: session.date,
    minutes: session.minutes,
    blocks: session.blocks.map((block, i) => ({
      movementId: block.movementId,
      pattern: block.pattern,
      outcome: outcomes[i] ?? "skipped",
    })),
  };

  return {
    profile: { patterns: nextPatterns, unlockedMilestones },
    history: { entries: [...history.entries, entry] },
    ledgerEvents,
    unlockedSkills,
  };
}
