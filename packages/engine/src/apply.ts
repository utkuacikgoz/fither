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
} from "./types";
import {
  CLEAN_SESSIONS_TO_ADVANCE,
  DAYS_AT_TIER_TO_ADVANCE,
  POINTS,
  STRUGGLED_SESSIONS_TO_REDUCE_VOLUME,
  STRUGGLED_SESSIONS_TO_REGRESS,
} from "./types";
import { PATTERNS } from "./profile";

/**
 * Whole calendar days from one ISO yyyy-mm-dd date to another. Pure
 * string-date math via `Date.UTC` (a pure function — no clock read, no
 * timezone). Exported so the UI can render floor countdowns without
 * re-deriving the rule.
 */
export function calendarDaysBetween(from: string, to: string): number {
  const utc = (iso: string): number => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

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
  // constraint fallbacks below it are both neutral (ADR-0007). Skipped
  // blocks are progression-neutral (ADR-0012): they count neither as
  // completed nor as struggled, so a pattern whose current-tier blocks
  // were all skipped is treated exactly like absence — untouched.
  const completed = new Set<Pattern>();
  const struggled = new Set<Pattern>();
  session.blocks.forEach((block, i) => {
    const movement = byId.get(block.movementId);
    const state = profile.patterns[block.pattern];
    if (!movement || movement.tier !== state.tier) return;
    if (outcomes[i] === "completed") completed.add(block.pattern);
    else if (outcomes[i] === "struggled") struggled.add(block.pattern);
  });
  // A pattern participates in progression only if some current-tier block
  // was actually attempted (completed or struggled).
  const seen = new Set<Pattern>([...completed, ...struggled]);

  const ledgerEvents: LedgerEvent[] = [];
  const unlockedSkills: ApplyResult["unlockedSkills"] = [];

  // Session completion points (ADR-0008): base + duration, showing up
  // dominating — 20/25/30 for 10/20/30 minutes. Requires at least one
  // completed block (decided; engine-spec ADR-0008 bullet) — a fully
  // skipped session earns nothing, but nothing is ever deducted either.
  if (outcomes.some((o) => o === "completed")) {
    ledgerEvents.push({
      type: "session",
      points: POINTS.perSessionByMinutes[session.minutes],
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
        // (volume-reduced) with fresh counters. Every tier change —
        // regress included — restarts the time-floor clock (ADR-0008).
        next.tier = Math.max(1, prev.tier - 1) as Tier;
        next.struggledStreak = 0;
        next.volumeReduced = true;
        next.tierSince = session.date;
      } else if (next.struggledStreak >= STRUGGLED_SESSIONS_TO_REDUCE_VOLUME) {
        next.volumeReduced = true;
      }
    } else {
      // Clean session: any clean session resets the struggle counter and
      // ends the volume-reduced soft landing.
      next.struggledStreak = 0;
      next.volumeReduced = false;
      next.cleanStreak = prev.cleanStreak + 1;
      // Advancement needs BOTH the clean streak and the time floor
      // (ADR-0008): DAYS_AT_TIER_TO_ADVANCE[tier] calendar days since the
      // tier was reached. Cleans keep banking while the floor is unmet —
      // the tier moves on the first clean session where both hold. A
      // state without tierSince treats the floor as satisfied once
      // (legacy tolerance); it is stamped below and real from then on.
      const floorMet =
        prev.tier < 6 &&
        (prev.tierSince === undefined ||
          calendarDaysBetween(prev.tierSince, session.date) >=
            DAYS_AT_TIER_TO_ADVANCE[prev.tier as Exclude<Tier, 6>]);
      if (next.cleanStreak >= CLEAN_SESSIONS_TO_ADVANCE && floorMet) {
        next.tier = (prev.tier + 1) as Tier;
        next.cleanStreak = 0;
        next.tierSince = session.date;
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
    // Tier changes are stamped above. Otherwise a missing tierSince gets
    // stamped now: the legacy tolerance spent its one free pass this
    // apply and the floor clock starts today. Patterns not in this
    // session are never touched (absence never regresses — nor stamps).
    if (next.tierSince === undefined) next.tierSince = session.date;
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
