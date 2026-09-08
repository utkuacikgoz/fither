/// <reference types="node" />
// FITHER coverage audit — every daily prompt the app can send, generated
// and checked against the answers it came from.
//
// The sim (run.ts) proves the gates over realistic USE; this audit proves
// the CONTRACT over the whole INPUT space: minutes x energy x quiet x the
// two equipment shapes onboarding offers x all 256 subsets of the eight
// body areas x a set of profiles x seeds, with an empty history and with a
// history the engine itself produced (8 weeks of the sim's 4x/week
// persona). For every generated session it records block count, emptiness,
// planned time against the budget, constraint violations, movement
// duplication, tier fidelity and thrown errors, then answers the owner's
// question directly: with one area avoided for 30 minutes, what do we do?
//
// Observes only. Never touches the engine or the library.
//
// Run from the repo root:
//   pnpm --filter @fither/engine coverage
// or, from packages/engine:
//   pnpm coverage

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import {
  applySessionResult,
  createInitialProfile,
  createRng,
  generateSession,
  unblockingAreas,
  CALIBRATION_MAX_SESSIONS,
  CALIBRATION_MAX_TIER,
  PATTERNS,
  TARGET_UTILIZATION,
  TRANSITION_SECONDS,
  type BlockOutcome,
  type BodyArea,
  type DailyPrompt,
  type Energy,
  type Equipment,
  type History,
  type Movement,
  type MovementLibrary,
  type Pattern,
  type Profile,
  type Session,
  type SessionMinutes,
  type Tier,
} from "../src/index.js";
import {
  blockOutcome,
  capabilityGain,
  initialCapability,
  weekPlan,
  type PersonaId,
} from "./personas.js";

// ---------- The prompt space the app can send ----------

/**
 * Presentation order of the area picker (app/src/lib/body-areas.ts). The
 * daily prompt filters BODY_AREAS by what she picked, so an avoid list
 * always arrives in this order — the enumeration below mirrors that.
 */
export const BODY_AREAS: readonly BodyArea[] = [
  "shoulders",
  "wrists",
  "elbows",
  "back",
  "hips",
  "knees",
  "ankles",
  "core",
];

export const MINUTES: readonly SessionMinutes[] = [10, 20, 30];
export const ENERGIES: readonly Energy[] = ["low", "okay", "strong"];
export const QUIETS: readonly boolean[] = [false, true];

/** The two equipment shapes onboarding/settings can store (settings-store.ts). */
export type EquipmentKey = "floor" | "chair";
export const EQUIPMENT_SETS: Readonly<Record<EquipmentKey, readonly Equipment[]>> = {
  floor: ["none", "wall"],
  chair: ["none", "chair", "wall"],
};
export const EQUIPMENT_KEYS: readonly EquipmentKey[] = ["floor", "chair"];

/** A session using less than this share of its budget counts as underfilled. */
export const UNDERFILL_THRESHOLD = 0.8;

/** The date every audited prompt carries (the engine never reads a clock). */
export const AUDIT_DATE = "2026-09-07";

/** All 256 subsets of the eight areas, by bitmask, each in BODY_AREAS order. */
export function allAvoidSets(): BodyArea[][] {
  const sets: BodyArea[][] = [];
  for (let mask = 0; mask < 1 << BODY_AREAS.length; mask++) {
    sets.push(BODY_AREAS.filter((_, i) => (mask >> i) & 1));
  }
  return sets;
}

export function avoidKey(avoid: readonly BodyArea[]): string {
  return avoid.length === 0 ? "(none)" : avoid.join("+");
}

// ---------- Profiles ----------

export type ProfileKey =
  | "fresh"
  | "tier2"
  | "tier4"
  | "mixed"
  | "legacy"
  | "trained8w";
export const PROFILE_KEYS: readonly ProfileKey[] = [
  "fresh",
  "tier2",
  "tier4",
  "mixed",
  "legacy",
  "trained8w",
];

export type HistoryKey = "empty" | "trained8w";
export const HISTORY_KEYS: readonly HistoryKey[] = ["empty", "trained8w"];

function uniformProfile(tier: Tier, tierSince: string): Profile {
  const p = createInitialProfile();
  for (const pattern of PATTERNS) {
    p.patterns[pattern] = {
      tier,
      cleanCount: 0,
      struggleCount: 0,
      volumeReduced: false,
      tierSince,
    };
  }
  return p;
}

/**
 * The fixed profiles. "mixed" also carries a volume-reduced pattern (hinge,
 * the soft landing) and a banked clean count, so the reduced-sets and
 * not-at-new-tier paths are exercised. "legacy" is the shape persisted
 * before ADR-0007/0008: no unlockedMilestones, no tierSince anywhere.
 */
export function fixedProfiles(): Record<Exclude<ProfileKey, "trained8w">, Profile> {
  const mixed = createInitialProfile();
  mixed.patterns.push = { tier: 5, cleanCount: 1, struggleCount: 0, volumeReduced: false, tierSince: "2026-07-01" };
  mixed.patterns.pull = { tier: 1, cleanCount: 2, struggleCount: 0, volumeReduced: false, tierSince: "2026-08-20" };
  mixed.patterns.squat = { tier: 3, cleanCount: 0, struggleCount: 1, volumeReduced: false, tierSince: "2026-07-15" };
  mixed.patterns.hinge = { tier: 2, cleanCount: 0, struggleCount: 2, volumeReduced: true, tierSince: "2026-08-01" };
  mixed.patterns.core = { tier: 4, cleanCount: 0, struggleCount: 0, volumeReduced: false, tierSince: "2026-09-01" };

  const legacy: Profile = {
    patterns: {
      push: { tier: 3, cleanCount: 1, struggleCount: 0, volumeReduced: false },
      pull: { tier: 3, cleanCount: 0, struggleCount: 0, volumeReduced: false },
      squat: { tier: 3, cleanCount: 2, struggleCount: 0, volumeReduced: false },
      hinge: { tier: 3, cleanCount: 0, struggleCount: 0, volumeReduced: false },
      core: { tier: 3, cleanCount: 0, struggleCount: 0, volumeReduced: false },
    },
  };

  return {
    fresh: createInitialProfile(),
    tier2: uniformProfile(2, "2026-08-24"),
    tier4: uniformProfile(4, "2026-08-10"),
    mixed,
    legacy,
  };
}

// ---------- A history the engine produced (mirrors run.ts) ----------

export const TRAINED_SEED = 20260907;
export const TRAINED_WEEKS = 8;
export const TRAINED_PERSONA: PersonaId = "consistent4";

// Same deterministic calendar as run.ts: week 1 day 0 = Monday 2026-01-05.
const BASE_UTC = Date.UTC(2026, 0, 5);
function isoDate(week: number, day: number): string {
  const d = new Date(BASE_UTC + ((week - 1) * 7 + day) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * One simulated user, trained for `weeks` weeks with the sim's behaviour
 * model (personas.ts) — the same loop body as run.ts, for one user. Returns
 * the profile and history the engine itself built. Seeded, reproducible.
 */
export function trainedUser(
  library: MovementLibrary,
  persona: PersonaId = TRAINED_PERSONA,
  weeks: number = TRAINED_WEEKS,
  seed: number = TRAINED_SEED,
): { profile: Profile; history: History } {
  const movementById = new Map(library.movements.map((m) => [m.id, m]));
  const rng = createRng(seed);
  const capability = initialCapability(rng, persona);
  let profile: Profile = createInitialProfile();
  let history: History = { entries: [] };
  for (let week = 1; week <= weeks; week++) {
    for (const plan of weekPlan(persona, rng)) {
      const prompt: DailyPrompt = {
        minutes: plan.minutes,
        energy: plan.energy,
        quiet: plan.quiet,
        avoid: plan.avoid,
        date: isoDate(week, plan.day),
        equipment: ["chair"],
      };
      const session = generateSession(
        library,
        profile,
        history,
        prompt,
        Math.floor(rng() * 0xffffffff),
      );
      const outcomes: BlockOutcome[] = session.blocks.map((block) => {
        const movement = movementById.get(block.movementId);
        if (!movement) return "skipped";
        return blockOutcome(
          rng,
          movement,
          profile.patterns[block.pattern],
          capability[block.pattern],
        );
      });
      const trained = new Map<Pattern, "completed" | "struggled">();
      session.blocks.forEach((block, i) => {
        const o = outcomes[i];
        if (o === "completed") trained.set(block.pattern, "completed");
        else if (o === "struggled" && !trained.has(block.pattern)) {
          trained.set(block.pattern, "struggled");
        }
      });
      for (const [p, kind] of trained) capability[p] += capabilityGain(persona, kind);
      const applied = applySessionResult(library, profile, history, { session, outcomes });
      profile = applied.profile;
      history = applied.history;
    }
  }
  return { profile, history };
}

// ---------- Per-session checks ----------

export interface Observation {
  blocks: number;
  empty: boolean;
  budget: number;
  total: number;
  utilization: number;
  overBudget: boolean;
  underfilled: boolean;
  /** Below the 90% the generator aims for (TARGET_UTILIZATION). */
  belowTarget: boolean;
  avoidViolations: number;
  equipmentViolations: number;
  quietViolations: number;
  /** Extra occurrences of a movement already in the session. */
  duplicates: number;
  /** Main blocks above the pattern's tier, or a malformed taste block. */
  tierViolations: number;
  /** estimatedTotalSeconds != sum of blocks, or a block's estimate does not
   * recompute from the movement's timing data. */
  timingMismatch: boolean;
  /** Patterns with an eligible movement today that got no block. */
  uncoveredAvailable: Pattern[];
  /** Patterns with at least one eligible movement today. */
  availablePatterns: Pattern[];
  eligibleMovements: number;
  error: string | null;
}

function workSeconds(m: Movement): number {
  const base =
    m.timing.type === "reps"
      ? m.timing.defaultValue * (m.timing.secondsPerRep ?? 4)
      : m.timing.defaultValue;
  return m.unilateral ? base * 2 : base;
}

export function eligible(m: Movement, prompt: DailyPrompt): boolean {
  if (prompt.quiet && !m.silent) return false;
  if (!prompt.equipment.includes(m.equipment)) return false;
  return !m.loads.some((a) => prompt.avoid.includes(a));
}

/** Check one generated session against the prompt and profile it came from. */
export function auditSession(
  library: MovementLibrary,
  movementById: ReadonlyMap<string, Movement>,
  profile: Profile,
  prompt: DailyPrompt,
  session: Session,
  /** History length the session was generated from (ADR-0026 calibration). */
  historyLength = 0,
): Observation {
  const budget = prompt.minutes * 60;
  const pool = library.movements.filter((m) => eligible(m, prompt));
  const availablePatterns = PATTERNS.filter((p) => pool.some((m) => m.pattern === p));
  const total = session.estimatedTotalSeconds;
  const utilization = total / budget;
  const seen = new Set<string>();
  let avoidViolations = 0;
  let equipmentViolations = 0;
  let quietViolations = 0;
  let duplicates = 0;
  let tierViolations = 0;
  let timingMismatch = false;
  let sum = 0;
  const covered = new Set<Pattern>();

  session.blocks.forEach((b, i) => {
    const m = movementById.get(b.movementId);
    if (!m) {
      tierViolations++;
      return;
    }
    covered.add(b.pattern);
    if (m.loads.some((a) => prompt.avoid.includes(a))) avoidViolations++;
    if (!prompt.equipment.includes(m.equipment)) equipmentViolations++;
    if (prompt.quiet && !m.silent) quietViolations++;
    if (seen.has(b.movementId)) duplicates++;
    seen.add(b.movementId);
    const state = profile.patterns[b.pattern];
    const isTaste = b.sets === 1;
    if (isTaste) {
      const claimed = session.adaptations.some(
        (a) =>
          a.kind === "calibrationTaste" &&
          a.pattern === b.pattern &&
          a.movementId === b.movementId,
      );
      // A calibration taste (ADR-0026): only while calibrating, only
      // below the calibration cap, one set, exactly tier + 1, announced
      // as one, and seated directly after a block of its own pattern.
      // A strong-energy taste (ADR-0007): strong only, one set, exactly
      // tier + 1, last block, unannounced.
      const previous = session.blocks[i - 1];
      const ok = claimed
        ? historyLength < CALIBRATION_MAX_SESSIONS &&
          state.tier < CALIBRATION_MAX_TIER &&
          m.tier === state.tier + 1 &&
          !b.atNewTier &&
          previous !== undefined &&
          previous.pattern === b.pattern &&
          previous.sets > 1
        : prompt.energy === "strong" &&
          m.tier === state.tier + 1 &&
          i === session.blocks.length - 1 &&
          !b.atNewTier;
      if (!ok) tierViolations++;
    } else if (m.tier > state.tier || m.pattern !== b.pattern) {
      tierViolations++;
    }
    const expected =
      TRANSITION_SECONDS + b.sets * workSeconds(m) + (b.sets - 1) * b.restSeconds;
    if (expected !== b.estimatedSeconds) timingMismatch = true;
    sum += b.estimatedSeconds;
  });
  if (sum !== total) timingMismatch = true;

  const empty = session.blocks.length === 0;
  return {
    blocks: session.blocks.length,
    empty,
    budget,
    total,
    utilization,
    overBudget: total > budget,
    underfilled: !empty && utilization < UNDERFILL_THRESHOLD,
    belowTarget: !empty && total < Math.floor(budget * TARGET_UTILIZATION),
    avoidViolations,
    equipmentViolations,
    quietViolations,
    duplicates,
    tierViolations,
    timingMismatch,
    uncoveredAvailable: availablePatterns.filter((p) => !covered.has(p)),
    availablePatterns,
    eligibleMovements: pool.length,
    error: null,
  };
}

// ---------- Aggregation ----------

export interface CaseRef {
  minutes: SessionMinutes;
  energy: Energy;
  quiet: boolean;
  equipment: EquipmentKey;
  avoid: BodyArea[];
  profile: ProfileKey;
  history: HistoryKey;
  seed: number;
}

export interface Failure {
  invariant: string;
  ref: CaseRef;
  detail: string;
  session: string;
}

export interface Bucket {
  total: number;
  empty: number;
  overBudget: number;
  underfilled: number;
  belowTarget: number;
  constraintViolations: number;
  duplicateSessions: number;
  tierViolations: number;
  timingMismatches: number;
  uncoveredWithBudget: number;
  errors: number;
  minUtilization: number;
}

export interface AreaStats {
  key: string;
  total: number;
  empty: number;
  underfilled: number;
  belowTarget: number;
  minUtilization: number;
  sumUtilization: number;
  sumBlocks: number;
  minBlocks: number;
  duplicateSessions: number;
  patternsEver: Set<Pattern>;
  patternsAlways: Set<Pattern>;
  availablePatterns: Set<Pattern>;
  emptyWithoutUnblocking: number;
  sample: string;
}

export interface CoverageResult {
  total: number;
  elapsedMs: number;
  librarySilent: boolean;
  buckets: Map<string, Bucket>;
  failures: Failure[];
  failureCounts: Map<string, number>;
  oneArea30: Map<BodyArea, AreaStats>;
  twoArea30: Map<string, AreaStats>;
  /** Avoid sets (any size) that ever produced an underfilled session, by minutes. */
  underfilledSets: Map<string, { minutes: Set<SessionMinutes>; count: number; minUtilization: number }>;
  /** Avoid sets that ever emptied the pool. */
  emptySets: Set<string>;
  firstEmptySize: number;
  firstUnderfilledSize: number;
  firstBelowTargetSize: number;
  quietIdentical: number;
  quietDifferent: number;
  options: Required<CoverageOptions>;
}

export interface CoverageOptions {
  minutes?: readonly SessionMinutes[];
  energies?: readonly Energy[];
  quiets?: readonly boolean[];
  equipment?: readonly EquipmentKey[];
  avoidSets?: readonly (readonly BodyArea[])[];
  profiles?: readonly ProfileKey[];
  histories?: readonly HistoryKey[];
  seeds?: readonly number[];
  /** Keep at most this many detailed failure records per invariant. */
  maxFailuresPerInvariant?: number;
}

function newBucket(): Bucket {
  return {
    total: 0,
    empty: 0,
    overBudget: 0,
    underfilled: 0,
    belowTarget: 0,
    constraintViolations: 0,
    duplicateSessions: 0,
    tierViolations: 0,
    timingMismatches: 0,
    uncoveredWithBudget: 0,
    errors: 0,
    minUtilization: 1,
  };
}

function newAreaStats(key: string): AreaStats {
  return {
    key,
    total: 0,
    empty: 0,
    underfilled: 0,
    belowTarget: 0,
    minUtilization: 1,
    sumUtilization: 0,
    sumBlocks: 0,
    minBlocks: Number.MAX_SAFE_INTEGER,
    duplicateSessions: 0,
    patternsEver: new Set(),
    patternsAlways: new Set(PATTERNS),
    availablePatterns: new Set(),
    emptyWithoutUnblocking: 0,
    sample: "",
  };
}

export function describeSession(session: Session, movementById: ReadonlyMap<string, Movement>): string {
  if (session.blocks.length === 0) return "(no blocks)";
  return session.blocks
    .map((b) => {
      const m = movementById.get(b.movementId);
      const unit = m?.timing.type === "seconds" ? "s" : " reps";
      return `${b.pattern}:${b.movementId}(t${m?.tier ?? "?"}) ${b.sets}x${b.amount}${unit} rest ${b.restSeconds}s = ${b.estimatedSeconds}s`;
    })
    .join("; ")
    .concat(` | total ${session.estimatedTotalSeconds}s`);
}

export function describeRef(ref: CaseRef): string {
  return `${ref.minutes}min ${ref.energy} quiet=${ref.quiet} ${ref.equipment} avoid=[${ref.avoid.join(",")}] profile=${ref.profile} history=${ref.history} seed=${ref.seed}`;
}

/**
 * Generate and audit every prompt in the requested space. Defaults to the
 * full space. Every check is recorded; nothing is asserted here — the
 * report and the vitest pin decide what must hold.
 */
export function runCoverage(library: MovementLibrary, options: CoverageOptions = {}): CoverageResult {
  const started = Date.now();
  const opts: Required<CoverageOptions> = {
    minutes: options.minutes ?? MINUTES,
    energies: options.energies ?? ENERGIES,
    quiets: options.quiets ?? QUIETS,
    equipment: options.equipment ?? EQUIPMENT_KEYS,
    avoidSets: options.avoidSets ?? allAvoidSets(),
    profiles: options.profiles ?? PROFILE_KEYS,
    histories: options.histories ?? HISTORY_KEYS,
    seeds: options.seeds ?? [1, 2, 3],
    maxFailuresPerInvariant: options.maxFailuresPerInvariant ?? 12,
  };
  const movementById = new Map(library.movements.map((m) => [m.id, m]));
  const librarySilent = library.movements.every((m) => m.silent);

  const trained = trainedUser(library);
  const profiles: Record<ProfileKey, Profile> = { ...fixedProfiles(), trained8w: trained.profile };
  const histories: Record<HistoryKey, History> = {
    empty: { entries: [] },
    trained8w: trained.history,
  };

  const buckets = new Map<string, Bucket>();
  const failures: Failure[] = [];
  const failureCounts = new Map<string, number>();
  const oneArea30 = new Map<BodyArea, AreaStats>();
  const twoArea30 = new Map<string, AreaStats>();
  const underfilledSets: CoverageResult["underfilledSets"] = new Map();
  const emptySets = new Set<string>();
  let firstEmptySize = Infinity;
  let firstUnderfilledSize = Infinity;
  let firstBelowTargetSize = Infinity;
  let quietIdentical = 0;
  let quietDifferent = 0;
  let total = 0;

  const fail = (invariant: string, ref: CaseRef, detail: string, session: Session | null) => {
    failureCounts.set(invariant, (failureCounts.get(invariant) ?? 0) + 1);
    if ((failureCounts.get(invariant) ?? 0) <= opts.maxFailuresPerInvariant) {
      failures.push({
        invariant,
        ref,
        detail,
        session: session ? describeSession(session, movementById) : "(threw)",
      });
    }
  };

  const bucketKey = (minutes: SessionMinutes, size: number) => `${minutes}:${size}`;

  const recordArea = (
    stats: AreaStats,
    obs: Observation,
    session: Session,
    ref: CaseRef,
    unblocking: BodyArea[] | null,
  ) => {
    stats.total++;
    if (obs.empty) {
      stats.empty++;
      if (unblocking !== null && unblocking.length === 0) stats.emptyWithoutUnblocking++;
      stats.patternsAlways.clear();
    } else {
      const covered = new Set(session.blocks.map((b) => b.pattern));
      for (const p of covered) stats.patternsEver.add(p);
      for (const p of [...stats.patternsAlways]) if (!covered.has(p)) stats.patternsAlways.delete(p);
      stats.sumUtilization += obs.utilization;
      stats.sumBlocks += obs.blocks;
      if (obs.blocks < stats.minBlocks) stats.minBlocks = obs.blocks;
      if (obs.utilization < stats.minUtilization) stats.minUtilization = obs.utilization;
    }
    if (obs.underfilled) stats.underfilled++;
    if (obs.belowTarget) stats.belowTarget++;
    if (obs.duplicates > 0) stats.duplicateSessions++;
    for (const p of obs.availablePatterns) stats.availablePatterns.add(p);
    if (
      stats.sample === "" &&
      ref.energy === "okay" &&
      !ref.quiet &&
      ref.equipment === "chair" &&
      ref.profile === "fresh" &&
      ref.history === "empty"
    ) {
      stats.sample = describeSession(session, movementById);
    }
  };

  for (const profileKey of opts.profiles) {
    const profile = profiles[profileKey];
    for (const historyKey of opts.histories) {
      const history = histories[historyKey];
      for (const minutes of opts.minutes) {
        for (const avoid of opts.avoidSets) {
          const size = avoid.length;
          const key = bucketKey(minutes, size);
          const bucket = buckets.get(key) ?? newBucket();
          buckets.set(key, bucket);
          for (const equipmentKey of opts.equipment) {
            for (const energy of opts.energies) {
              for (const seed of opts.seeds) {
                let quietBaseline: string | null = null;
                for (const quiet of opts.quiets) {
                  const ref: CaseRef = {
                    minutes,
                    energy,
                    quiet,
                    equipment: equipmentKey,
                    avoid: [...avoid],
                    profile: profileKey,
                    history: historyKey,
                    seed,
                  };
                  const prompt: DailyPrompt = {
                    minutes,
                    energy,
                    quiet,
                    avoid: [...avoid],
                    date: AUDIT_DATE,
                    equipment: [...EQUIPMENT_SETS[equipmentKey]],
                  };
                  total++;
                  bucket.total++;

                  let session: Session;
                  try {
                    session = generateSession(library, profile, history, prompt, seed);
                  } catch (e) {
                    bucket.errors++;
                    fail("noThrow", ref, e instanceof Error ? e.message : String(e), null);
                    continue;
                  }
                  const obs = auditSession(
                    library,
                    movementById,
                    profile,
                    prompt,
                    session,
                    history.entries.length,
                  );

                  if (quietBaseline === null) {
                    quietBaseline = JSON.stringify(session);
                  } else if (quietBaseline === JSON.stringify(session)) {
                    quietIdentical++;
                  } else {
                    quietDifferent++;
                    if (librarySilent) fail("quietNoOpOnSilentLibrary", ref, "quiet changed the session", session);
                  }

                  if (obs.empty) {
                    bucket.empty++;
                    emptySets.add(avoidKey(avoid));
                    if (size < firstEmptySize) firstEmptySize = size;
                  }
                  if (obs.overBudget) {
                    bucket.overBudget++;
                    fail("withinBudget", ref, `${obs.total}s > ${obs.budget}s`, session);
                  }
                  if (obs.underfilled) {
                    bucket.underfilled++;
                    if (size < firstUnderfilledSize) firstUnderfilledSize = size;
                    const k = avoidKey(avoid);
                    const u = underfilledSets.get(k) ?? { minutes: new Set(), count: 0, minUtilization: 1 };
                    u.minutes.add(minutes);
                    u.count++;
                    if (obs.utilization < u.minUtilization) u.minUtilization = obs.utilization;
                    underfilledSets.set(k, u);
                    fail("filledAtLeast80pct", ref, `${obs.total}s of ${obs.budget}s (${(100 * obs.utilization).toFixed(1)}%)`, session);
                  }
                  if (obs.belowTarget) {
                    bucket.belowTarget++;
                    if (size < firstBelowTargetSize) firstBelowTargetSize = size;
                    if (size <= 1) {
                      fail("filledToTargetWithAtMostOneAvoid", ref, `${obs.total}s of ${obs.budget}s`, session);
                    }
                  }
                  const violations = obs.avoidViolations + obs.equipmentViolations + obs.quietViolations;
                  if (violations > 0) {
                    bucket.constraintViolations += violations;
                    fail(
                      "honoursConstraints",
                      ref,
                      `avoid=${obs.avoidViolations} equipment=${obs.equipmentViolations} quiet=${obs.quietViolations}`,
                      session,
                    );
                  }
                  if (obs.duplicates > 0) {
                    bucket.duplicateSessions++;
                    fail("noRepeatedMovement", ref, `${obs.duplicates} repeat(s)`, session);
                  }
                  if (obs.tierViolations > 0) {
                    bucket.tierViolations += obs.tierViolations;
                    fail("prescribesAtOrBelowTier", ref, `${obs.tierViolations} block(s)`, session);
                  }
                  if (obs.timingMismatch) {
                    bucket.timingMismatches++;
                    fail("timingRecomputes", ref, "estimate does not recompute", session);
                  }
                  if (obs.empty && size === 0) {
                    fail("neverEmptyWithoutAvoid", ref, "empty with an empty avoid list", session);
                  }
                  if (obs.empty !== (obs.eligibleMovements === 0)) {
                    fail(
                      "emptyIffPoolEmpty",
                      ref,
                      `blocks=${obs.blocks} eligibleMovements=${obs.eligibleMovements}`,
                      session,
                    );
                  }
                  // An available pattern left out while budget remained for
                  // its cheapest 2-set block means coverage was skipped.
                  if (obs.uncoveredAvailable.length > 0 && !obs.empty) {
                    const cheapest = Math.min(
                      ...obs.uncoveredAvailable.map((p) => {
                        const ms = library.movements.filter(
                          (m) => m.pattern === p && eligible(m, prompt),
                        );
                        return Math.min(...ms.map((m) => TRANSITION_SECONDS + 2 * workSeconds(m) + 45));
                      }),
                    );
                    // Compare against the unpadded main budget (rest padding
                    // happens after coverage, taste reserve before it).
                    // Calibration tastes (one set) are part of what the
                    // main phase spent, so they stay in the total.
                    const unpadded = session.blocks.reduce(
                      (acc, b) => acc + (b.estimatedSeconds - (b.sets - 1) * (b.restSeconds - 45)),
                      0,
                    );
                    const mainBudget = obs.budget - (energy === "strong" ? 60 : 0);
                    if (unpadded + cheapest <= mainBudget) {
                      bucket.uncoveredWithBudget++;
                      fail(
                        "coversEveryAvailablePatternWhenItFits",
                        ref,
                        `uncovered=${obs.uncoveredAvailable.join(",")} unpadded=${unpadded}s cheapest=${cheapest}s main=${mainBudget}s`,
                        session,
                      );
                    }
                  }
                  if (!obs.empty && obs.utilization < bucket.minUtilization) {
                    bucket.minUtilization = obs.utilization;
                  }

                  let unblocking: BodyArea[] | null = null;
                  if (obs.empty && size >= 1) {
                    unblocking = unblockingAreas(library, profile, history, prompt, seed);
                    if (unblocking.length === 0) {
                      fail("unblockingNonEmptyWhenEmpty", ref, "unblockingAreas returned []", session);
                    }
                  }

                  if (minutes === 30 && size === 1) {
                    const area = avoid[0] as BodyArea;
                    const stats = oneArea30.get(area) ?? newAreaStats(area);
                    oneArea30.set(area, stats);
                    recordArea(stats, obs, session, ref, unblocking);
                  } else if (minutes === 30 && size === 2) {
                    const k = avoidKey(avoid);
                    const stats = twoArea30.get(k) ?? newAreaStats(k);
                    twoArea30.set(k, stats);
                    recordArea(stats, obs, session, ref, unblocking);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    total,
    elapsedMs: Date.now() - started,
    librarySilent,
    buckets,
    failures,
    failureCounts,
    oneArea30,
    twoArea30,
    underfilledSets,
    emptySets,
    firstEmptySize,
    firstUnderfilledSize,
    firstBelowTargetSize,
    quietIdentical,
    quietDifferent,
    options: opts,
  };
}

// ---------- Library facts the owner asked to see ----------

/** Which areas each pattern's ladder loads, per tier, and which single
 * area removes the whole pattern. */
export function ladderAreaTable(library: MovementLibrary): string {
  const rows: string[] = [];
  rows.push("| pattern | tier | movements (equipment) | areas loaded (every movement at the tier) | areas loaded (some) |");
  rows.push("|---|---|---|---|---|");
  for (const pattern of PATTERNS) {
    for (let tier = 1; tier <= 6; tier++) {
      const ms = library.movements.filter((m) => m.pattern === pattern && m.tier === tier);
      const all = BODY_AREAS.filter((a) => ms.every((m) => m.loads.includes(a)));
      const some = BODY_AREAS.filter((a) => !all.includes(a) && ms.some((m) => m.loads.includes(a)));
      rows.push(
        `| ${pattern} | ${tier} | ${ms.map((m) => `${m.id} (${m.equipment})`).join(", ")} | ${all.join(", ") || "-"} | ${some.join(", ") || "-"} |`,
      );
    }
  }
  rows.push("");
  rows.push("| pattern | a single avoided area that removes the WHOLE pattern |");
  rows.push("|---|---|");
  for (const pattern of PATTERNS) {
    const ms = library.movements.filter((m) => m.pattern === pattern);
    const killers = BODY_AREAS.filter((a) => ms.every((m) => m.loads.includes(a)));
    rows.push(`| ${pattern} | ${killers.join(", ") || "(none)"} |`);
  }
  return rows.join("\n");
}

// ---------- Report ----------

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

export function formatReport(r: CoverageResult, library: MovementLibrary): string {
  const out: string[] = [];
  const o = r.options;
  out.push("# Coverage audit — the whole daily-prompt space");
  out.push("");
  out.push(
    `${r.total} prompts generated in ${(r.elapsedMs / 1000).toFixed(1)}s: ` +
      `minutes {${o.minutes.join(",")}} x energy {${o.energies.join(",")}} x quiet {${o.quiets.join(",")}} x ` +
      `equipment {${o.equipment.join(",")}} x ${o.avoidSets.length} avoid sets x profiles {${o.profiles.join(",")}} x ` +
      `histories {${o.histories.join(",")}} x seeds {${o.seeds.join(",")}}. Date ${AUDIT_DATE}.`,
  );
  out.push(
    `Library: ${library.movements.length} movements, all silent: ${r.librarySilent}. ` +
      `Quiet=true vs quiet=false: ${r.quietIdentical} identical, ${r.quietDifferent} different.`,
  );
  out.push("");

  out.push("## Invariants");
  out.push("");
  const invariants = [
    ["noThrow", "generateSession never throws"],
    ["withinBudget", "estimatedTotalSeconds <= minutes * 60"],
    ["timingRecomputes", "block and total estimates recompute from movement timing"],
    ["honoursConstraints", "no block loads an avoided area / needs missing equipment / is loud when quiet"],
    ["prescribesAtOrBelowTier", "main blocks at or below the pattern's tier; taste = 1 set, tier+1 (strong: last; calibration: after its own block)"],
    ["neverEmptyWithoutAvoid", "an empty avoid list always gets a session"],
    ["emptyIffPoolEmpty", "a session is empty exactly when no movement survives the filter"],
    ["unblockingNonEmptyWhenEmpty", "empty with avoid.length >= 1 => unblockingAreas non-empty"],
    ["quietNoOpOnSilentLibrary", "with an all-silent library, quiet changes nothing"],
    ["coversEveryAvailablePatternWhenItFits", "no available pattern is left out while its cheapest block still fits"],
    ["filledToTargetWithAtMostOneAvoid", "avoid.length <= 1 => filled to the 90% target"],
    ["filledAtLeast80pct", `every non-empty session uses >= ${pct(UNDERFILL_THRESHOLD)} of its budget`],
    ["noRepeatedMovement", "no movement appears twice in a session"],
  ] as const;
  out.push("| invariant | meaning | violations |");
  out.push("|---|---|---|");
  for (const [k, meaning] of invariants) {
    const n = r.failureCounts.get(k) ?? 0;
    out.push(`| ${k} | ${meaning} | ${n === 0 ? "0 (holds)" : `${n} (FAILS)`} |`);
  }
  out.push("");

  out.push("## By minutes x avoid-set size");
  out.push("");
  out.push(
    "| minutes | avoid size | prompts | empty | over budget | underfilled (<80%) | below 90% target | constraint violations | repeated movement | tier violations | timing mismatches | uncovered w/ budget | errors | min util (non-empty) |",
  );
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const minutes of o.minutes) {
    for (let size = 0; size <= BODY_AREAS.length; size++) {
      const b = r.buckets.get(`${minutes}:${size}`);
      if (!b) continue;
      out.push(
        `| ${minutes} | ${size} | ${b.total} | ${b.empty} | ${b.overBudget} | ${b.underfilled} | ${b.belowTarget} | ${b.constraintViolations} | ${b.duplicateSessions} | ${b.tierViolations} | ${b.timingMismatches} | ${b.uncoveredWithBudget} | ${b.errors} | ${b.total === b.empty ? "-" : pct(b.minUtilization)} |`,
      );
    }
  }
  out.push("");
  out.push(
    `First empty session at avoid size ${r.firstEmptySize}; first underfilled (<80%) at size ${r.firstUnderfilledSize}; first below the 90% target at size ${r.firstBelowTargetSize}.`,
  );
  out.push(`Avoid sets that empty the pool (${r.emptySets.size}): ${[...r.emptySets].sort().join(", ") || "none"}.`);
  out.push("");

  const areaRow = (s: AreaStats) => {
    const nonEmpty = s.total - s.empty;
    return (
      `| ${s.key} | ${s.total} | ${s.empty} | ${s.underfilled} | ${s.belowTarget} | ` +
      `${nonEmpty ? pct(s.minUtilization) : "-"} | ${nonEmpty ? pct(s.sumUtilization / nonEmpty) : "-"} | ` +
      `${nonEmpty ? `${s.minBlocks}..${(s.sumBlocks / nonEmpty).toFixed(1)} avg` : "-"} | ${s.duplicateSessions} | ` +
      `${[...s.availablePatterns].join(",") || "-"} | ${[...s.patternsAlways].join(",") || "-"} | ` +
      `${s.empty ? (s.emptyWithoutUnblocking === 0 ? "yes" : `NO (${s.emptyWithoutUnblocking})`) : "n/a"} |`
    );
  };
  const areaHeader = () => {
    out.push(
      "| avoid | prompts | empty | underfilled (<80%) | below 90% | min util | mean util | blocks (min..avg) | repeated movement | patterns available | patterns in every session | unblocking non-empty when empty |",
    );
    out.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  };

  out.push("## One area avoided, 30 minutes");
  out.push("");
  areaHeader();
  for (const area of BODY_AREAS) {
    const s = r.oneArea30.get(area);
    if (s) out.push(areaRow(s));
  }
  out.push("");
  out.push("Sample session per area (fresh profile, empty history, okay energy, not quiet, chair, first seed):");
  out.push("");
  for (const area of BODY_AREAS) {
    const s = r.oneArea30.get(area);
    if (s) out.push(`- **${area}**: ${s.sample || "(no sample in this run)"}`);
  }
  out.push("");

  out.push("## Two areas avoided, 30 minutes");
  out.push("");
  areaHeader();
  for (const [, s] of [...r.twoArea30.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    out.push(areaRow(s));
  }
  out.push("");

  out.push("## Underfilled avoid sets (any minutes)");
  out.push("");
  if (r.underfilledSets.size === 0) {
    out.push("None.");
  } else {
    out.push("| avoid set | minutes affected | underfilled sessions | worst utilisation |");
    out.push("|---|---|---|---|");
    for (const [k, u] of [...r.underfilledSets.entries()].sort(([a], [b]) => a.split("+").length - b.split("+").length || a.localeCompare(b))) {
      out.push(`| ${k} | ${[...u.minutes].sort((a, b) => a - b).join(",")} | ${u.count} | ${pct(u.minUtilization)} |`);
    }
  }
  out.push("");

  out.push("## Failing cases (first few per invariant)");
  out.push("");
  if (r.failures.length === 0) {
    out.push("None.");
  } else {
    let last = "";
    for (const f of r.failures) {
      if (f.invariant !== last) {
        out.push(`### ${f.invariant} (${r.failureCounts.get(f.invariant) ?? 0} total)`);
        out.push("");
        last = f.invariant;
      }
      out.push(`- ${describeRef(f.ref)} -> ${f.detail}`);
      out.push(`  session: ${f.session}`);
    }
  }
  out.push("");

  out.push("## Which areas each ladder touches");
  out.push("");
  out.push(ladderAreaTable(library));
  out.push("");
  return out.join("\n");
}

// ---------- Main ----------

const invokedDirectly =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const here = dirname(fileURLToPath(import.meta.url));
  const library: MovementLibrary = JSON.parse(
    readFileSync(join(here, "../../../data/movements.json"), "utf8"),
  );
  const result = runCoverage(library);
  console.log(formatReport(result, library));
  // Hard failures: the contract the app relies on. Underfill and repeats
  // are reported above but do not fail the run — they are findings for
  // the owner, not gates (see docs/engine-decision-tree.md).
  const hard = [
    "noThrow",
    "withinBudget",
    "timingRecomputes",
    "honoursConstraints",
    "prescribesAtOrBelowTier",
    "neverEmptyWithoutAvoid",
    "emptyIffPoolEmpty",
    "unblockingNonEmptyWhenEmpty",
    "filledAtLeast80pct",
  ];
  const broken = hard.filter((k) => (result.failureCounts.get(k) ?? 0) > 0);
  if (broken.length > 0) {
    console.error(`Hard invariants violated: ${broken.join(", ")}`);
    process.exit(1);
  }
}
