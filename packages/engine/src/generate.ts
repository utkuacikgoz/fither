import type {
  Adaptation,
  DailyPrompt,
  History,
  Movement,
  MovementLibrary,
  Pattern,
  Profile,
  Session,
  SessionBlock,
} from "./types";
import { createRng } from "./rng";
import { PATTERNS } from "./profile";

// ---------- Prescription constants (PROPOSED defaults, engine-spec.md) ----------

/** Setup/transition seconds charged to every block (get in position, read cues). */
export const TRANSITION_SECONDS = 20;
/** Rest between sets within a block. Padding may raise it up to MAX_REST_SECONDS. */
export const DEFAULT_REST_SECONDS = 45;
export const MAX_REST_SECONDS = 90;
/** Sets per block at okay/strong energy. */
export const BASE_SETS = 3;
/** Sets per block at low energy or while a pattern is volume-reduced. */
export const REDUCED_SETS = 2;
/** Blocks never shrink below this many sets (taste blocks are 1 set). */
export const MIN_SETS = 2;
/** Aim to fill at least this fraction of the time budget. */
export const TARGET_UTILIZATION = 0.9;
/** Seconds held back for the optional strong-energy taste block. */
export const TASTE_RESERVE_SECONDS = 60;
/**
 * A staleFocus adaptation is emitted when the session's top-priority
 * pattern has been absent for at least this many training days.
 * PROPOSED default (ADR-0006 follow-up): below 3 the ordinary rotation of
 * short sessions would announce "focus" almost every day, which is noise.
 */
export const STALE_FOCUS_MIN_TRAINING_DAYS = 3;

/**
 * Variety cap: with all five patterns available a pattern appears at most
 * twice per session. When constraints (avoid areas) shrink the pattern set,
 * the survivors carry more blocks so the budget still gets filled.
 */
function maxBlocksPerPattern(availablePatterns: number): number {
  if (availablePatterns >= 5) return 2;
  if (availablePatterns === 4) return 3;
  return 4;
}

// ---------- Constraint filter ----------

function quietOk(m: Movement, prompt: DailyPrompt): boolean {
  return !prompt.quiet || m.silent;
}

/** Wall (and bodyweight) is always available — every home has one. */
function equipmentOk(m: Movement, prompt: DailyPrompt): boolean {
  return (
    m.equipment === "none" ||
    m.equipment === "wall" ||
    prompt.equipment.includes(m.equipment)
  );
}

function avoidOk(m: Movement, prompt: DailyPrompt): boolean {
  return !m.loads.some((area) => prompt.avoid.includes(area));
}

function movementEligible(m: Movement, prompt: DailyPrompt): boolean {
  return quietOk(m, prompt) && equipmentOk(m, prompt) && avoidOk(m, prompt);
}

// ---------- Staleness (pattern coverage, gate 4) ----------

/**
 * Training days since the pattern last appeared in a session.
 * Absence is measured in sessions trained, not calendar days — a user who
 * takes two weeks off is never penalised for it (absence never regresses,
 * and staleness only accrues while training).
 */
export function trainingDaysSincePattern(
  history: History,
  pattern: Pattern,
): number {
  const entries = history.entries;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry && entry.blocks.some((b) => b.pattern === pattern)) {
      return entries.length - 1 - i;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

// ---------- Block timing ----------

function workSecondsPerSet(m: Movement, amount: number): number {
  const base =
    m.timing.type === "reps" ? amount * (m.timing.secondsPerRep ?? 4) : amount;
  // Unilateral movements are performed on both sides.
  return m.unilateral ? base * 2 : base;
}

function blockSeconds(m: Movement, sets: number, rest: number): number {
  const work = workSecondsPerSet(m, m.timing.defaultValue);
  return TRANSITION_SECONDS + sets * work + (sets - 1) * rest;
}

function makeBlock(m: Movement, sets: number, atNewTier: boolean): SessionBlock {
  return {
    movementId: m.id,
    pattern: m.pattern,
    sets,
    amount: m.timing.defaultValue,
    restSeconds: DEFAULT_REST_SECONDS,
    estimatedSeconds: blockSeconds(m, sets, DEFAULT_REST_SECONDS),
    atNewTier,
  };
}

// ---------- Session generation ----------

export function generateSession(
  library: MovementLibrary,
  profile: Profile,
  history: History,
  prompt: DailyPrompt,
  seed: number,
): Session {
  const rng = createRng(seed);
  const budget = prompt.minutes * 60;

  const pool = library.movements.filter((m) => movementEligible(m, prompt));

  // Adaptation honesty (ADR-0006): a constraint is reported only when it
  // actually changed today's session — here, when it excluded at least one
  // movement that every other constraint would have allowed. A quiet
  // request over an already-silent remainder, or an avoid area nothing
  // loads, changed nothing and therefore says nothing.
  const sorenessChanged =
    prompt.avoid.length > 0 &&
    library.movements.some(
      (m) => quietOk(m, prompt) && equipmentOk(m, prompt) && !avoidOk(m, prompt),
    );
  const quietChanged =
    prompt.quiet &&
    library.movements.some(
      (m) => !quietOk(m, prompt) && equipmentOk(m, prompt) && avoidOk(m, prompt),
    );

  // Pattern priority: stalest first. Ties broken by a seeded shuffle so
  // brand-new users still get varied-but-deterministic sessions.
  const order = [...PATTERNS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = order[i] as Pattern;
    order[i] = order[j] as Pattern;
    order[j] = a;
  }
  const stale = new Map<Pattern, number>();
  for (const p of PATTERNS) stale.set(p, trainingDaysSincePattern(history, p));
  order.sort((a, b) => (stale.get(b) ?? 0) - (stale.get(a) ?? 0));

  const usedIds = new Set<string>();
  const blocksPerPattern = new Map<Pattern, number>();
  const blocks: SessionBlock[] = [];
  let total = 0;

  // Adaptation tracking — set only by what actually lands in the session.
  let energyReducedABlock = false;
  const softLandingPatterns = new Set<Pattern>();
  let tasteAdded: { pattern: Pattern; movementId: string } | null = null;

  const pickMovement = (pattern: Pattern, tier: number): Movement | null => {
    // Prescribe at current tier; if constraints removed every movement at
    // that tier, fall back down the ladder rather than dropping the pattern.
    for (let t = tier; t >= 1; t--) {
      const candidates = pool.filter(
        (m) => m.pattern === pattern && m.tier === t,
      );
      if (candidates.length === 0) continue;
      const fresh = candidates.filter((m) => !usedIds.has(m.id));
      const list = fresh.length > 0 ? fresh : candidates;
      return list[Math.floor(rng() * list.length)] ?? null;
    }
    return null;
  };

  const wantTaste = prompt.energy === "strong";
  const mainBudget = wantTaste ? budget - TASTE_RESERVE_SECONDS : budget;

  const availablePatterns = PATTERNS.filter((p) =>
    pool.some((m) => m.pattern === p),
  ).length;
  const patternCap = maxBlocksPerPattern(availablePatterns);

  const tryAddBlock = (pattern: Pattern): boolean => {
    if ((blocksPerPattern.get(pattern) ?? 0) >= patternCap) {
      return false;
    }
    const state = profile.patterns[pattern];
    const m = pickMovement(pattern, state.tier);
    if (!m) return false;
    const reduced = prompt.energy === "low" || state.volumeReduced;
    const desiredSets = reduced ? REDUCED_SETS : BASE_SETS;
    // First session at a freshly reached tier: flag its blocks so completing
    // them earns the new-tier bonus (gamification.md).
    const atNewTier =
      state.tier > 1 &&
      state.cleanCount === 0 &&
      state.struggleCount === 0 &&
      !state.volumeReduced &&
      m.tier === state.tier;
    for (let sets = desiredSets; sets >= MIN_SETS; sets--) {
      const cost = blockSeconds(m, sets, DEFAULT_REST_SECONDS);
      if (total + cost <= mainBudget) {
        blocks.push(makeBlock(m, sets, atNewTier));
        usedIds.add(m.id);
        blocksPerPattern.set(pattern, (blocksPerPattern.get(pattern) ?? 0) + 1);
        total += cost;
        // Attribute the reduction honestly: soft landing per pattern; low
        // energy only where it (not the budget) cut a block from 3 sets to 2.
        if (state.volumeReduced) softLandingPatterns.add(pattern);
        else if (
          prompt.energy === "low" &&
          total - cost + blockSeconds(m, BASE_SETS, DEFAULT_REST_SECONDS) <=
            mainBudget
        ) {
          energyReducedABlock = true;
        }
        return true;
      }
    }
    return false;
  };

  // Round 1: one block per pattern, stalest first — coverage before volume.
  // Further rounds add helpings while the budget and variety cap allow.
  for (let round = 0; round < patternCap; round++) {
    let added = false;
    for (const pattern of order) {
      if (tryAddBlock(pattern)) added = true;
    }
    if (!added) break;
  }

  // Strong energy: one optional taste block of the next tier, late in the
  // session. One set, purely a preview — it never affects progression state.
  if (wantTaste) {
    for (const pattern of order) {
      const state = profile.patterns[pattern];
      if (state.tier >= 6) continue;
      if (!blocksPerPattern.has(pattern)) continue; // only taste what you trained
      const candidates = pool.filter(
        (m) => m.pattern === pattern && m.tier === state.tier + 1,
      );
      if (candidates.length === 0) continue;
      const m = candidates[Math.floor(rng() * candidates.length)];
      if (!m) continue;
      const cost = blockSeconds(m, 1, DEFAULT_REST_SECONDS);
      if (total + cost <= budget) {
        // A next-tier preview is not a tier the user has reached. It is
        // progression- and points-neutral in either outcome (ADR-0007).
        blocks.push(makeBlock(m, 1, false));
        total += cost;
        tasteAdded = { pattern, movementId: m.id };
      }
      break;
    }
  }

  // Padding: lengthen rests (never volume) until we sit inside 90–100% of
  // the budget. Rest is honest time — it is counted, and it never overflows.
  const target = Math.floor(budget * TARGET_UTILIZATION);
  let padded = true;
  while (total < target && padded) {
    padded = false;
    for (const b of blocks) {
      if (b.sets < 2) continue;
      if (b.restSeconds >= MAX_REST_SECONDS) continue;
      const extra = b.sets - 1; // +1s of rest costs (sets - 1) seconds
      if (total + extra > budget) continue;
      b.restSeconds += 1;
      b.estimatedSeconds += extra;
      total += extra;
      padded = true;
      if (total >= target) break;
    }
  }

  // Assemble adaptations, ordered by importance (ADR-0006):
  // soreness, quiet, energy, softLanding, staleFocus, taste.
  const adaptations: Adaptation[] = [];
  if (sorenessChanged) {
    adaptations.push({ kind: "soreness", areas: [...prompt.avoid] });
  }
  if (quietChanged) adaptations.push({ kind: "quiet" });
  if (energyReducedABlock) adaptations.push({ kind: "lowEnergy" });
  for (const p of PATTERNS) {
    if (softLandingPatterns.has(p)) {
      adaptations.push({ kind: "softLanding", pattern: p });
    }
  }
  // Stale focus: the top-priority pattern led the session because it had
  // gone genuinely stale. Staleness is capped at the history length — a
  // brand-new user has nothing to be stale against — and reported only
  // when the pattern actually received a block today.
  const stalest = order[0];
  if (stalest) {
    const staleness = Math.min(
      stale.get(stalest) ?? 0,
      history.entries.length,
    );
    if (
      staleness >= STALE_FOCUS_MIN_TRAINING_DAYS &&
      blocksPerPattern.has(stalest)
    ) {
      adaptations.push({ kind: "staleFocus", pattern: stalest });
    }
  }
  if (tasteAdded) {
    adaptations.push({
      kind: "tasteBlock",
      pattern: tasteAdded.pattern,
      movementId: tasteAdded.movementId,
    });
  }

  return {
    date: prompt.date,
    minutes: prompt.minutes,
    blocks,
    estimatedTotalSeconds: total,
    seed,
    adaptations,
  };
}
