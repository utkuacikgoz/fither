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
  SkillMilestone,
  Tier,
} from "./types";
import {
  CALIBRATION_MAX_SESSIONS,
  CALIBRATION_MAX_TIER,
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
 * The tier this pattern EARNED the ordinary way — the mark
 * `regressionFloor` is measured from (ADR-0026, owner decision
 * 2026-09-08). Exported so the UI can name it without re-deriving the
 * legacy default: a state persisted before `earnedTier` existed reads as
 * its current tier, so no migration hands an existing user a deeper fall
 * than the ordinary one-tier drop.
 */
export function earnedTierOf(state: PatternState): Tier {
  return state.earnedTier ?? state.tier;
}

/**
 * The lowest tier repeated struggle may ever take this pattern to
 * (ADR-0026 as narrowed by the owner, 2026-09-08): one tier below what
 * she EARNED, never below tier 1.
 *
 * An earned tier is not a ratchet. ADR-0003's ordinary struggle-driven
 * drop still applies to it — she may fall one tier below the ground the
 * clean-count rule gave her, and no further. What `earnedTier` buys is
 * that a tier calibration merely PLACED her at can be corrected all the
 * way back down to the earned tier without that being a regression.
 *
 * Exported so the UI can say how far the floor is without re-deriving
 * the rule.
 */
export function regressionFloor(state: PatternState): Tier {
  return Math.max(1, earnedTierOf(state) - 1) as Tier;
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

/**
 * The nearest milestone she has NOT yet earned — what the app points at
 * next (ADR-0013's home hub asked for it; the UI must never derive this,
 * because "already unlocked" and the legacy-profile case are engine
 * rules, not display logic).
 *
 * Nearest means fewest tiers away from where that pattern stands today;
 * ties break in PATTERNS order so the answer is deterministic. A tier
 * already at or past a milestone counts it as earned even when
 * `unlockedMilestones` has no entry — profiles that trained before that
 * field existed must not be promised a skill they already hold. Null
 * only when every milestone in every pattern is behind her.
 */
export function nextMilestone(profile: Profile): SkillMilestone | null {
  const unlocked = profile.unlockedMilestones ?? [];
  let best: { milestone: SkillMilestone; distance: number } | null = null;
  for (const pattern of PATTERNS) {
    const tier = profile.patterns[pattern].tier;
    for (const milestoneTier of SKILL_MILESTONE_TIERS) {
      if (milestoneTier <= tier) continue; // reached — earned or legacy
      if (
        unlocked.some(
          (m) => m.pattern === pattern && m.tier === milestoneTier,
        )
      ) {
        continue;
      }
      const distance = milestoneTier - tier;
      if (best === null || distance < best.distance) {
        best = { milestone: { pattern, tier: milestoneTier }, distance };
      }
      break; // milestone tiers ascend: the first unearned one is nearest
    }
  }
  return best?.milestone ?? null;
}

/** How many tiers she is from `milestone` in its own pattern. */
export function tiersToMilestone(
  profile: Profile,
  milestone: SkillMilestone,
): number {
  return Math.max(0, milestone.tier - profile.patterns[milestone.pattern].tier);
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
      next.cleanCount = 0;
      next.struggleCount = prev.struggleCount + 1;
      if (next.struggleCount >= STRUGGLED_SESSIONS_TO_REGRESS) {
        // Third consecutive struggle: drop one tier, land softly
        // (volume-reduced) with fresh counters. The drop stops at
        // `regressionFloor` — one tier below what she EARNED (ADR-0026
        // as narrowed 2026-09-08), never below tier 1. So the ordinary
        // struggle-driven drop still reaches an earned tier exactly
        // once, and a tier calibration merely placed her at can be
        // corrected all the way back to the earned floor. Below that,
        // repeated struggle answers with the volume-reduced soft landing
        // where she stands.
        const floor = regressionFloor(prev);
        const target = Math.max(floor, prev.tier - 1) as Tier;
        next.struggleCount = 0;
        next.volumeReduced = true;
        if (target < prev.tier) {
          next.tier = target;
          // Every tier change — regress included — restarts the
          // time-floor clock (ADR-0008).
          next.tierSince = session.date;
        }
      } else if (next.struggleCount >= STRUGGLED_SESSIONS_TO_REDUCE_VOLUME) {
        next.volumeReduced = true;
      }
    } else {
      // Clean session: any clean session resets the struggle counter and
      // ends the volume-reduced soft landing.
      next.struggleCount = 0;
      next.volumeReduced = false;
      next.cleanCount = prev.cleanCount + 1;
      // Advancement needs BOTH the clean count and the time floor
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
      if (next.cleanCount >= CLEAN_SESSIONS_TO_ADVANCE && floorMet) {
        next.tier = (prev.tier + 1) as Tier;
        next.cleanCount = 0;
        next.tierSince = session.date;
        // The ordinary rule put her here, so this tier is EARNED
        // (ADR-0026): no later regression may take it back.
        next.earnedTier = next.tier;
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
      // Tier 6 is terminal: cleanCount keeps counting, tier never changes.
    }
    // Tier changes are stamped above. Otherwise a missing tierSince gets
    // stamped now: the legacy tolerance spent its one free pass this
    // apply and the floor clock starts today. Patterns not in this
    // session are never touched (absence never regresses — nor stamps).
    if (next.tierSince === undefined) next.tierSince = session.date;
    // Same legacy tolerance for the earned floor (ADR-0026): a state
    // persisted before the field existed keeps the ground it already
    // stands on. Stamped here, BEFORE any calibration placement below,
    // so a placement never counts as earned.
    if (next.earnedTier === undefined) next.earnedTier = next.tier;
    nextPatterns[pattern] = next;
  }

  // Starting-level calibration (ADR-0026). Sessions one and two only:
  // a calibration taste the engine actually offered (it says so in the
  // session's adaptations) and she completed without struggling raises
  // where that pattern STARTS next session, by exactly one tier, capped
  // at CALIBRATION_MAX_TIER. A struggled or skipped taste changes
  // nothing, and the taste itself stays progression- and points-neutral:
  // it earns no clean-session credit and no ledger event.
  if (history.entries.length < CALIBRATION_MAX_SESSIONS) {
    for (const adaptation of session.adaptations) {
      if (adaptation.kind !== "calibrationTaste") continue;
      const { pattern, movementId } = adaptation;
      const index = session.blocks.findIndex(
        (block, i) =>
          block.pattern === pattern &&
          block.movementId === movementId &&
          block.sets === 1 &&
          outcomes[i] !== undefined,
      );
      if (index < 0 || outcomes[index] !== "completed") continue;
      const before = profile.patterns[pattern];
      const movement = byId.get(movementId);
      // The taste must be exactly one rung above where she started the
      // session — the same step the ladder takes anyway.
      if (!movement || movement.tier !== before.tier + 1) continue;
      if (before.tier >= CALIBRATION_MAX_TIER) continue;
      // Never more than one tier per session: a pattern the ordinary
      // rules already moved today is left alone.
      const current = nextPatterns[pattern];
      if (current.tier !== before.tier) continue;
      // A pattern she struggled at her CURRENT tier in this same session
      // is not started higher, whatever the taste said. Judgment call
      // beyond the owner's four answers (flagged in ADR-0026): it can
      // only ever prevent an unearned jump, never cause one.
      if (struggled.has(pattern)) continue;
      nextPatterns[pattern] = {
        ...current,
        tier: (before.tier + 1) as Tier,
        cleanCount: 0,
        struggleCount: 0,
        volumeReduced: false,
        // Placement is not earning (ADR-0026). The earned floor stays
        // where it was — resolved explicitly, because a pattern whose
        // own block was skipped never reached the stamp above and would
        // otherwise read its new, unearned tier as earned.
        earnedTier: earnedTierOf(current),
        // A tier change, so the ADR-0008 floor clock restarts here.
        tierSince: session.date,
      };
    }
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
