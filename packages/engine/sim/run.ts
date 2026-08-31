/// <reference types="node" />
// FITHER simulation harness — 500 users, 26 weeks, one seed.
// Prints the Gate 1 numbers and exits non-zero if any gate fails.
// The engine stays pure; all IO and behaviour modelling happens here.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  applySessionResult,
  createInitialProfile,
  createRng,
  generateSession,
  PATTERNS,
  type BlockOutcome,
  type DailyPrompt,
  type History,
  type MovementLibrary,
  type Pattern,
  type Profile,
} from "../src/index.js";
import {
  blockOutcome,
  capabilityGain,
  initialCapability,
  weekPlan,
  type PersonaId,
} from "./personas.js";

const SEED = 20260831;
const USERS = 500;
const WEEKS = 26;
const G1_WEEK_LIMIT = 12;
const G1_TIER = 4;
const G4_LIMIT = 7; // training days (sessions), per engine-spec.md gate 4
// G5 (ADR-0008): ceiling gate. No consistent persona's MEDIAN week of
// full-ladder exhaustion (all five patterns at tier 6) may precede this.
// "Never within 26 weeks" passes. Erratic has no consistent cadence and
// is reported for information only.
const G5_WEEK_LIMIT = 18;
const G5_PERSONAS: readonly PersonaId[] = [
  "consistent4",
  "consistent2",
  "lowCapability2",
  "quiet",
  "tenMin",
];

const here = dirname(fileURLToPath(import.meta.url));
const library: MovementLibrary = JSON.parse(
  readFileSync(join(here, "../../../data/movements.json"), "utf8"),
);
const movementById = new Map(library.movements.map((m) => [m.id, m]));

const PERSONAS: PersonaId[] = [
  "consistent4",
  "consistent2",
  "lowCapability2",
  "erratic",
  "quiet",
  "tenMin",
];

// Deterministic calendar: week 1 day 0 = Monday 2026-01-05.
const BASE_UTC = Date.UTC(2026, 0, 5);
function isoDate(week: number, day: number): string {
  const d = new Date(BASE_UTC + ((week - 1) * 7 + day) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// ---------- Gate accumulators ----------

let sessionsGenerated = 0;
let overBudgetCount = 0;
let maxUtilization = 0;
let minUtilization = 1;
const g1WeekReached: number[] = []; // per consistent4 user; Infinity if never
let g2Regressions = 0;
let lowCapabilityBlocks = 0;
let lowCapabilityDifficultBlocks = 0;
let g4MaxAbsence = 0;
const personaCounts = new Map<PersonaId, number>();
// G5: per-persona weeks of full-ladder exhaustion (Infinity = never).
const g5ExhaustWeeks = new Map<PersonaId, number[]>();
for (const persona of PERSONAS) g5ExhaustWeeks.set(persona, []);

/** Median where an even split against "never" (Infinity) is still never. */
function medianWeek(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid] as number;
  const lo = s[mid - 1] ?? Infinity;
  const hi = s[mid] ?? Infinity;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return Infinity;
  return (lo + hi) / 2;
}

// ---------- Run ----------

const rootRng = createRng(SEED);

for (let u = 0; u < USERS; u++) {
  const persona = PERSONAS[u % PERSONAS.length] as PersonaId;
  personaCounts.set(persona, (personaCounts.get(persona) ?? 0) + 1);
  const rng = createRng(Math.floor(rootRng() * 0xffffffff) ^ u);
  const capability = initialCapability(rng, persona);

  let profile: Profile = createInitialProfile();
  let history: History = { entries: [] };
  const absence: Record<Pattern, number> = {
    push: 0,
    pull: 0,
    squat: 0,
    hinge: 0,
    core: 0,
  };
  let pushTier4Week = Infinity;
  let exhaustWeek = Infinity;

  for (let week = 1; week <= WEEKS; week++) {
    for (const plan of weekPlan(persona, rng)) {
      const prompt: DailyPrompt = {
        minutes: plan.minutes,
        energy: plan.energy,
        quiet: plan.quiet,
        avoid: plan.avoid,
        date: isoDate(week, plan.day),
        equipment: ["chair"],
      };
      const sessionSeed = Math.floor(rng() * 0xffffffff);
      const session = generateSession(
        library,
        profile,
        history,
        prompt,
        sessionSeed,
      );
      sessionsGenerated++;

      // Gate 3: hard time budget.
      const budget = plan.minutes * 60;
      const utilization = session.estimatedTotalSeconds / budget;
      if (session.estimatedTotalSeconds > budget) overBudgetCount++;
      if (utilization > maxUtilization) maxUtilization = utilization;
      if (session.blocks.length > 0 && utilization < minUtilization) {
        minUtilization = utilization;
      }

      // Gate 4: pattern absence in training days.
      const covered = new Set(session.blocks.map((b) => b.pattern));
      for (const p of PATTERNS) {
        if (covered.has(p)) {
          absence[p] = 0;
        } else {
          absence[p] += 1;
          if (absence[p] > g4MaxAbsence) g4MaxAbsence = absence[p];
        }
      }

      // Behave: hidden capability decides struggle, never Math.random.
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
      if (persona === "lowCapability2") {
        lowCapabilityBlocks += outcomes.length;
        lowCapabilityDifficultBlocks += outcomes.filter(
          (outcome) => outcome !== "completed",
        ).length;
      }

      // Training grows capability (once per pattern per session).
      const trained = new Map<Pattern, "completed" | "struggled">();
      session.blocks.forEach((block, i) => {
        const o = outcomes[i];
        if (o === "completed") trained.set(block.pattern, "completed");
        else if (o === "struggled" && !trained.has(block.pattern)) {
          trained.set(block.pattern, "struggled");
        }
      });
      for (const [p, kind] of trained) {
        capability[p] += capabilityGain(persona, kind);
      }

      const before = profile;
      const applied = applySessionResult(library, profile, history, {
        session,
        outcomes,
      });
      profile = applied.profile;
      history = applied.history;

      // Gate 2: 2×/week users never lose a tier.
      if (persona === "consistent2" || persona === "lowCapability2") {
        for (const p of PATTERNS) {
          if (profile.patterns[p].tier < before.patterns[p].tier) {
            g2Regressions++;
          }
        }
      }

      // Gate 1: week the 4×/week persona reaches push tier >= 4.
      if (
        persona === "consistent4" &&
        pushTier4Week === Infinity &&
        profile.patterns.push.tier >= G1_TIER
      ) {
        pushTier4Week = week;
      }

      // G5: first week ALL five patterns sit at tier 6.
      if (
        exhaustWeek === Infinity &&
        PATTERNS.every((p) => profile.patterns[p].tier === 6)
      ) {
        exhaustWeek = week;
      }
    }
  }

  if (persona === "consistent4") g1WeekReached.push(pushTier4Week);
  g5ExhaustWeeks.get(persona)?.push(exhaustWeek);
}

// ---------- Report ----------

const g1Total = g1WeekReached.length;
const g1ByWeek12 = g1WeekReached.filter((w) => w <= G1_WEEK_LIMIT).length;
const g1Pct = (100 * g1ByWeek12) / g1Total;
const sorted = [...g1WeekReached].sort((a, b) => a - b);
const mid = Math.floor(sorted.length / 2);
const g1Median =
  sorted.length % 2 === 1
    ? sorted[mid]
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;

const g1Pass = g1ByWeek12 === g1Total;
const g2Pass = g2Regressions === 0;
const g3Pass = overBudgetCount === 0;
const g4Pass = g4MaxAbsence <= G4_LIMIT;

const g5Medians = new Map<PersonaId, number>();
for (const persona of PERSONAS) {
  g5Medians.set(persona, medianWeek(g5ExhaustWeeks.get(persona) ?? []));
}
const g5Pass = G5_PERSONAS.every(
  (persona) => (g5Medians.get(persona) ?? Infinity) >= G5_WEEK_LIMIT,
);
const fmtExhaust = (w: number) => (Number.isFinite(w) ? String(w) : "never");

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const mark = (ok: boolean) => (ok ? "PASS" : "FAIL");

console.log(
  `FITHER sim — seed ${SEED}, ${USERS} users, ${WEEKS} weeks, ${sessionsGenerated} sessions`,
);
console.log(
  `Personas: ${PERSONAS.map((persona) => `${persona}=${personaCounts.get(persona) ?? 0}`).join(", ")}`,
);
console.log(
  `G1 ${mark(g1Pass)}  4x/week push tier >= ${G1_TIER} by week ${G1_WEEK_LIMIT}: ` +
    `${g1ByWeek12}/${g1Total} users (${g1Pct.toFixed(1)}%), median week ${g1Median}`,
);
console.log(
  `G2 ${mark(g2Pass)}  2x/week tier regressions: ${g2Regressions}; ` +
    `low-capability difficult blocks: ${lowCapabilityDifficultBlocks}/${lowCapabilityBlocks}`,
);
console.log(
  `G3 ${mark(g3Pass)}  sessions over time budget: ${overBudgetCount} of ${sessionsGenerated}, ` +
    `max utilization ${pct(maxUtilization)}, min ${pct(minUtilization)}`,
);
console.log(
  `G4 ${mark(g4Pass)}  max pattern absence: ${g4MaxAbsence} training days (limit ${G4_LIMIT})`,
);
console.log(
  `G5 ${mark(g5Pass)}  median full-ladder exhaustion week (consistent personas must be >= ${G5_WEEK_LIMIT} or never): ` +
    G5_PERSONAS.map(
      (persona) => `${persona}=${fmtExhaust(g5Medians.get(persona) ?? Infinity)}`,
    ).join(", ") +
    `; erratic=${fmtExhaust(g5Medians.get("erratic") ?? Infinity)} (info only)`,
);

if (!(g1Pass && g2Pass && g3Pass && g4Pass && g5Pass)) {
  process.exit(1);
}
