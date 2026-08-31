/// <reference types="node" />
// FITHER simulation deep-dive — HOW users progress, not just that gates pass.
//
// Reuses the run.ts harness model verbatim: same personas, same behaviour
// functions (personas.ts), same calendar, and the exact same RNG consumption
// order, so with the default seed this analyses the very same 500-user /
// 26-week run that `pnpm sim` gates on. It never touches the engine or the
// behaviour model — it only observes.
//
// Run from the repo root:
//   pnpm --filter @fither/engine exec tsx sim/analyze.ts
//
// Prints a markdown report for the primary seed, then a stability check
// against a second seed. Findings live in docs/sim-analysis.md.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
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
  type SessionMinutes,
} from "../src/index.js";
import {
  blockOutcome,
  capabilityGain,
  initialCapability,
  weekPlan,
  type PersonaId,
} from "./personas.js";

// ---------- Run parameters (must mirror run.ts to reproduce its run) ----------

export const PRIMARY_SEED = 20260831; // same seed as `pnpm sim`
export const SECOND_SEED = 20270101; // stability check only
export const DEFAULT_USERS = 500;
export const DEFAULT_WEEKS = 26;

/** Persona assignment order — identical to run.ts (user u gets u % 6). */
export const PERSONAS: readonly PersonaId[] = [
  "consistent4",
  "consistent2",
  "lowCapability2",
  "erratic",
  "quiet",
  "tenMin",
];

const TIER_SNAPSHOT_WEEKS = [4, 8, 12, 26] as const;
const POINTS_SNAPSHOT_WEEKS = [1, 4, 12, 26] as const;
const SKILL_TIER = 4;
const MINUTES: readonly SessionMinutes[] = [10, 20, 30];

// Deterministic calendar: week 1 day 0 = Monday 2026-01-05 (same as run.ts).
const BASE_UTC = Date.UTC(2026, 0, 5);
function isoDate(week: number, day: number): string {
  const d = new Date(BASE_UTC + ((week - 1) * 7 + day) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// ---------- Collected shapes ----------

interface UserRecord {
  persona: PersonaId;
  sessions: number;
  struggledSessions: number; // >= 1 struggled block
  bonusSessions: number; // >= 1 non-session ledger event
  points: number; // cumulative, end of run
  tiersAtWeek: Map<number, Record<Pattern, number>>;
  pointsAtWeek: Map<number, number>;
  /** Week the pattern first reached tier >= 4; Infinity if never. */
  unlockWeek: Record<Pattern, number>;
  /** Week of the FIRST tier-4 unlock in any pattern; Infinity if never. */
  firstAnyUnlockWeek: number;
  /** First week ALL five patterns sit at tier 6 (ADR-0008 G5); Infinity if never. */
  fullLadderWeek: number;
  reductionEpisodes: number; // volumeReduced false -> true transitions
  regressionEpisodes: number; // tier drops
  volumeReducedSessions: number; // sessions starting with >= 1 reduced pattern
  volumeReducedPatternSessions: number; // (pattern, session) pairs reduced at start
  rescueOpportunities: number; // reduced pattern trained at current tier
  rescueClean: number; // ...and came out clean (reduction lifted)
  rescueRegressed: number; // ...and dropped a tier instead
  fallbackSessions: number; // >= 1 block below the pattern's current tier
  strongSessions: number;
  tasteSessions: number; // strong sessions that actually got a taste block
}

interface MinutesStats {
  utilizations: number[];
  blockCounts: Map<number, number>;
  patternCounts: Map<number, number>;
}

export interface Analysis {
  seed: number;
  users: number;
  weeks: number;
  sessionsGenerated: number;
  emptySessions: number;
  byPersona: Map<PersonaId, UserRecord[]>;
  byMinutes: Map<SessionMinutes, MinutesStats>;
}

// ---------- The run (RNG order mirrors run.ts exactly) ----------

export function runAnalysis(
  library: MovementLibrary,
  seed: number,
  users = DEFAULT_USERS,
  weeks = DEFAULT_WEEKS,
): Analysis {
  const movementById = new Map(library.movements.map((m) => [m.id, m]));
  const byPersona = new Map<PersonaId, UserRecord[]>();
  for (const p of PERSONAS) byPersona.set(p, []);
  const byMinutes = new Map<SessionMinutes, MinutesStats>();
  for (const m of MINUTES) {
    byMinutes.set(m, {
      utilizations: [],
      blockCounts: new Map(),
      patternCounts: new Map(),
    });
  }

  let sessionsGenerated = 0;
  let emptySessions = 0;

  const rootRng = createRng(seed);

  for (let u = 0; u < users; u++) {
    const persona = PERSONAS[u % PERSONAS.length] as PersonaId;
    const rng = createRng(Math.floor(rootRng() * 0xffffffff) ^ u);
    const capability = initialCapability(rng, persona);

    let profile: Profile = createInitialProfile();
    let history: History = { entries: [] };

    const rec: UserRecord = {
      persona,
      sessions: 0,
      struggledSessions: 0,
      bonusSessions: 0,
      points: 0,
      tiersAtWeek: new Map(),
      pointsAtWeek: new Map(),
      unlockWeek: {
        push: Infinity,
        pull: Infinity,
        squat: Infinity,
        hinge: Infinity,
        core: Infinity,
      },
      firstAnyUnlockWeek: Infinity,
      fullLadderWeek: Infinity,
      reductionEpisodes: 0,
      regressionEpisodes: 0,
      volumeReducedSessions: 0,
      volumeReducedPatternSessions: 0,
      rescueOpportunities: 0,
      rescueClean: 0,
      rescueRegressed: 0,
      fallbackSessions: 0,
      strongSessions: 0,
      tasteSessions: 0,
    };

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
        const sessionSeed = Math.floor(rng() * 0xffffffff);
        const session = generateSession(
          library,
          profile,
          history,
          prompt,
          sessionSeed,
        );
        sessionsGenerated++;
        rec.sessions++;

        // ----- Composition & budget (before behaviour) -----
        const stats = byMinutes.get(plan.minutes);
        if (stats) {
          if (session.blocks.length === 0) {
            emptySessions++;
          } else {
            stats.utilizations.push(
              session.estimatedTotalSeconds / (plan.minutes * 60),
            );
          }
          bump(stats.blockCounts, session.blocks.length);
          bump(
            stats.patternCounts,
            new Set(session.blocks.map((b) => b.pattern)).size,
          );
        }

        const before = profile;
        let hasFallback = false;
        for (const block of session.blocks) {
          const movement = movementById.get(block.movementId);
          if (
            movement &&
            movement.tier < before.patterns[block.pattern].tier
          ) {
            hasFallback = true;
          }
        }
        if (hasFallback) rec.fallbackSessions++;
        if (plan.energy === "strong") {
          rec.strongSessions++;
          if (session.adaptations.some((a) => a.kind === "tasteBlock")) {
            rec.tasteSessions++;
          }
        }

        const reducedAtStart = PATTERNS.filter(
          (p) => before.patterns[p].volumeReduced,
        );
        if (reducedAtStart.length > 0) rec.volumeReducedSessions++;
        rec.volumeReducedPatternSessions += reducedAtStart.length;

        // Which reduced patterns actually got current-tier work today
        // (the only blocks the progression state machine "sees").
        const trainedAtTier = new Set<Pattern>();
        for (const block of session.blocks) {
          const movement = movementById.get(block.movementId);
          if (movement && movement.tier === before.patterns[block.pattern].tier) {
            trainedAtTier.add(block.pattern);
          }
        }

        // ----- Behaviour (identical RNG consumption to run.ts) -----
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
        for (const [p, kind] of trained) {
          capability[p] += capabilityGain(persona, kind);
        }

        const applied = applySessionResult(library, profile, history, {
          session,
          outcomes,
        });
        profile = applied.profile;
        history = applied.history;

        // ----- Outcome accounting -----
        if (outcomes.some((o) => o === "struggled")) rec.struggledSessions++;
        for (const event of applied.ledgerEvents) rec.points += event.points;
        if (applied.ledgerEvents.some((e) => e.type !== "session")) {
          rec.bonusSessions++;
        }

        for (const p of PATTERNS) {
          const prev = before.patterns[p];
          const next = profile.patterns[p];
          if (!prev.volumeReduced && next.volumeReduced) {
            rec.reductionEpisodes++;
          }
          if (next.tier < prev.tier) rec.regressionEpisodes++;
          if (prev.volumeReduced && trainedAtTier.has(p)) {
            rec.rescueOpportunities++;
            if (!next.volumeReduced && next.tier === prev.tier) {
              rec.rescueClean++;
            } else if (next.tier < prev.tier) {
              rec.rescueRegressed++;
            }
          }
          if (rec.unlockWeek[p] === Infinity && next.tier >= SKILL_TIER) {
            rec.unlockWeek[p] = week;
            if (week < rec.firstAnyUnlockWeek) rec.firstAnyUnlockWeek = week;
          }
        }
        if (
          rec.fullLadderWeek === Infinity &&
          PATTERNS.every((p) => profile.patterns[p].tier === 6)
        ) {
          rec.fullLadderWeek = week;
        }
      }

      // ----- End-of-week snapshots -----
      if ((TIER_SNAPSHOT_WEEKS as readonly number[]).includes(week)) {
        const tiers = {} as Record<Pattern, number>;
        for (const p of PATTERNS) tiers[p] = profile.patterns[p].tier;
        rec.tiersAtWeek.set(week, tiers);
      }
      if ((POINTS_SNAPSHOT_WEEKS as readonly number[]).includes(week)) {
        rec.pointsAtWeek.set(week, rec.points);
      }
    }

    byPersona.get(persona)?.push(rec);
  }

  return {
    seed,
    users,
    weeks,
    sessionsGenerated,
    emptySessions,
    byPersona,
    byMinutes,
  };
}

// ---------- Small stats helpers ----------

function bump(map: Map<number, number>, key: number): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid] as number;
  const lo = s[mid - 1] as number;
  const hi = s[mid] as number;
  // Median between a finite week and "never" is still "never".
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return Infinity;
  return (lo + hi) / 2;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    s.length - 1,
    Math.max(0, Math.round((p / 100) * (s.length - 1))),
  );
  return s[idx] as number;
}

function fmtWeek(w: number, weeks: number): string {
  return Number.isFinite(w) ? String(w) : `>${weeks}`;
}

function pct(x: number, digits = 1): string {
  return `${(100 * x).toFixed(digits)}%`;
}

function distLine(map: Map<number, number>): string {
  const keys = [...map.keys()].sort((a, b) => a - b);
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return keys
    .map((k) => `${k}: ${pct((map.get(k) ?? 0) / total, 1)}`)
    .join(", ");
}

// ---------- Report ----------

export function formatReport(a: Analysis): string {
  const out: string[] = [];
  const line = (s = "") => out.push(s);

  line(
    `## Run: seed ${a.seed}, ${a.users} users, ${a.weeks} weeks, ` +
      `${a.sessionsGenerated} sessions (${a.emptySessions} empty)`,
  );
  line();

  // 1. Tier progression curves.
  line(`### 1. Median tier per pattern (end of week 4 / 8 / 12 / 26)`);
  line();
  for (const persona of PERSONAS) {
    const recs = a.byPersona.get(persona) ?? [];
    line(`**${persona}** (${recs.length} users)`);
    line();
    line(`| pattern | w4 | w8 | w12 | w26 |`);
    line(`|---|---|---|---|---|`);
    for (const p of PATTERNS) {
      const cells = TIER_SNAPSHOT_WEEKS.map((w) =>
        median(recs.map((r) => r.tiersAtWeek.get(w)?.[p] ?? 1)),
      );
      line(`| ${p} | ${cells.join(" | ")} |`);
    }
    line();
  }

  // 2. Time to first tier-4 unlock.
  line(`### 2. Weeks to first skill unlock (tier 4) — median [p10, p90]`);
  line();
  line(
    `| persona | first (any pattern) | push | pull | squat | hinge | core | never any |`,
  );
  line(`|---|---|---|---|---|---|---|---|`);
  for (const persona of PERSONAS) {
    const recs = a.byPersona.get(persona) ?? [];
    const cell = (vals: number[]) =>
      `${fmtWeek(median(vals), a.weeks)} [${fmtWeek(percentile(vals, 10), a.weeks)}, ${fmtWeek(percentile(vals, 90), a.weeks)}]`;
    const any = recs.map((r) => r.firstAnyUnlockWeek);
    const never = recs.filter((r) => !Number.isFinite(r.firstAnyUnlockWeek))
      .length;
    const patterns = PATTERNS.map((p) =>
      cell(recs.map((r) => r.unlockWeek[p])),
    );
    line(
      `| ${persona} | ${cell(any)} | ${patterns.join(" | ")} | ${never}/${recs.length} |`,
    );
  }
  line();

  // 3. Points trajectory.
  line(`### 3. Median cumulative points (end of week 1 / 4 / 12 / 26)`);
  line();
  line(`| persona | w1 | w4 | w12 | w26 | sessions/user (median) | bonus sessions |`);
  line(`|---|---|---|---|---|---|---|`);
  for (const persona of PERSONAS) {
    const recs = a.byPersona.get(persona) ?? [];
    const cells = POINTS_SNAPSHOT_WEEKS.map((w) =>
      median(recs.map((r) => r.pointsAtWeek.get(w) ?? 0)),
    );
    const sessions = recs.reduce((s, r) => s + r.sessions, 0);
    const bonus = recs.reduce((s, r) => s + r.bonusSessions, 0);
    line(
      `| ${persona} | ${cells.join(" | ")} | ${median(recs.map((r) => r.sessions))} | ${pct(sessions ? bonus / sessions : 0)} |`,
    );
  }
  line();

  // 4. Struggle economics.
  line(`### 4. Struggle economics`);
  line();
  line(
    `| persona | struggled-session rate | reduction episodes/user | users ever regressed | ` +
      `sessions started volume-reduced | rescue: clean / opportunities |`,
  );
  line(`|---|---|---|---|---|---|`);
  for (const persona of PERSONAS) {
    const recs = a.byPersona.get(persona) ?? [];
    const sessions = recs.reduce((s, r) => s + r.sessions, 0);
    const struggled = recs.reduce((s, r) => s + r.struggledSessions, 0);
    const reductions = recs.reduce((s, r) => s + r.reductionEpisodes, 0);
    const regressedUsers = recs.filter((r) => r.regressionEpisodes > 0).length;
    const reducedSessions = recs.reduce(
      (s, r) => s + r.volumeReducedSessions,
      0,
    );
    const opps = recs.reduce((s, r) => s + r.rescueOpportunities, 0);
    const clean = recs.reduce((s, r) => s + r.rescueClean, 0);
    line(
      `| ${persona} | ${pct(sessions ? struggled / sessions : 0)} | ` +
        `${(reductions / Math.max(1, recs.length)).toFixed(2)} | ` +
        `${regressedUsers}/${recs.length} | ` +
        `${reducedSessions} (${pct(sessions ? reducedSessions / sessions : 0)}) | ` +
        `${clean}/${opps}${opps ? ` (${pct(clean / opps)})` : ""} |`,
    );
  }
  line();

  // 5. Session composition.
  line(`### 5. Session composition by length`);
  line();
  for (const minutes of MINUTES) {
    const stats = a.byMinutes.get(minutes);
    if (!stats) continue;
    const n = [...stats.blockCounts.values()].reduce((x, y) => x + y, 0);
    line(`**${minutes} min** (${n} sessions)`);
    line(`- blocks/session: ${distLine(stats.blockCounts)}`);
    line(`- distinct patterns/session: ${distLine(stats.patternCounts)}`);
    line();
  }
  line(`Fallback (below-tier block) and taste rates per persona:`);
  line();
  line(
    `| persona | sessions with a below-tier fallback | taste blocks / strong-energy sessions |`,
  );
  line(`|---|---|---|`);
  for (const persona of PERSONAS) {
    const recs = a.byPersona.get(persona) ?? [];
    const sessions = recs.reduce((s, r) => s + r.sessions, 0);
    const fallback = recs.reduce((s, r) => s + r.fallbackSessions, 0);
    const strong = recs.reduce((s, r) => s + r.strongSessions, 0);
    const taste = recs.reduce((s, r) => s + r.tasteSessions, 0);
    line(
      `| ${persona} | ${fallback}/${sessions} (${pct(sessions ? fallback / sessions : 0)}) | ` +
        `${taste}/${strong}${strong ? ` (${pct(taste / strong)})` : ""} |`,
    );
  }
  line();

  // 6. Budget utilization.
  line(`### 6. Budget utilization (non-empty sessions)`);
  line();
  line(`| length | min | median | max | 90-92% | 92-94% | 94-96% | 96-98% | 98-100% |`);
  line(`|---|---|---|---|---|---|---|---|---|`);
  for (const minutes of MINUTES) {
    const stats = a.byMinutes.get(minutes);
    if (!stats || stats.utilizations.length === 0) continue;
    const u = stats.utilizations;
    const bucket = (lo: number, hi: number) =>
      pct(u.filter((x) => x >= lo && x < hi).length / u.length);
    line(
      `| ${minutes} min | ${pct(Math.min(...u))} | ${pct(median(u))} | ` +
        `${pct(Math.max(...u))} | ${bucket(0.9, 0.92)} | ${bucket(0.92, 0.94)} | ` +
        `${bucket(0.94, 0.96)} | ${bucket(0.96, 0.98)} | ${bucket(0.98, 1.0000001)} |`,
    );
  }
  line();

  // 7. Full-ladder exhaustion (ADR-0008 G5 observed at persona level).
  line(`### 7. Full-ladder exhaustion (all five patterns at tier 6)`);
  line();
  line(`| persona | median week [p10, p90] | never within run |`);
  line(`|---|---|---|`);
  for (const persona of PERSONAS) {
    const recs = a.byPersona.get(persona) ?? [];
    const weeks = recs.map((r) => r.fullLadderWeek);
    const never = weeks.filter((w) => !Number.isFinite(w)).length;
    line(
      `| ${persona} | ${fmtWeek(median(weeks), a.weeks)} ` +
        `[${fmtWeek(percentile(weeks, 10), a.weeks)}, ${fmtWeek(percentile(weeks, 90), a.weeks)}] | ` +
        `${never}/${recs.length} |`,
    );
  }
  line();

  return out.join("\n");
}

/** Compact key metrics for cross-seed stability comparison. */
export function keyMetrics(a: Analysis): string {
  const rows: string[] = [];
  for (const persona of PERSONAS) {
    const recs = a.byPersona.get(persona) ?? [];
    const first = median(recs.map((r) => r.firstAnyUnlockWeek));
    const w26 = median(
      recs.map((r) => {
        const tiers = r.tiersAtWeek.get(a.weeks);
        return tiers
          ? PATTERNS.reduce((s, p) => s + tiers[p], 0) / PATTERNS.length
          : NaN;
      }),
    );
    const pts = median(recs.map((r) => r.pointsAtWeek.get(a.weeks) ?? 0));
    const exhaust = median(recs.map((r) => r.fullLadderWeek));
    rows.push(
      `  ${persona}: first unlock median wk ${fmtWeek(first, a.weeks)}, ` +
        `mean tier @w${a.weeks} ${w26.toFixed(1)}, median points ${pts}, ` +
        `full-ladder exhaustion median wk ${fmtWeek(exhaust, a.weeks)}`,
    );
  }
  return rows.join("\n");
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

  const primary = runAnalysis(library, PRIMARY_SEED);
  console.log(formatReport(primary));

  const second = runAnalysis(library, SECOND_SEED);
  console.log(`## Stability check — second seed ${SECOND_SEED}`);
  console.log();
  console.log(`Primary (seed ${PRIMARY_SEED}, ${primary.sessionsGenerated} sessions):`);
  console.log(keyMetrics(primary));
  console.log();
  console.log(`Second (seed ${SECOND_SEED}, ${second.sessionsGenerated} sessions):`);
  console.log(keyMetrics(second));
}
