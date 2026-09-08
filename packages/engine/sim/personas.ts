// Simulated user behaviour lives HERE, not in the engine. Everything is
// driven by the run's seeded RNG — one seed reproduces the whole run.

import type {
  BlockOutcome,
  BodyArea,
  Energy,
  Movement,
  Pattern,
  PatternState,
  Rng,
  SessionMinutes,
} from "../src/index.js";

export type PersonaId =
  | "consistent4"
  | "consistent2"
  | "lowCapability2"
  | "erratic"
  | "quiet"
  | "tenMin"
  /**
   * The woman ADR-0026's calibration exists for: 4x/week like
   * consistent4, but she already trains — her push and squat capability
   * starts around tier 3, so she completes the calibration tastes on
   * those two ladders in sessions one and two and answers "Strong". Her
   * other three patterns are ordinary. Everything about her behaviour
   * is the same model as every other persona; only the hidden starting
   * capability differs.
   */
  | "experienced";

export interface PersonaDay {
  day: number; // 0..6 within the week
  minutes: SessionMinutes;
  energy: Energy;
  quiet: boolean;
  avoid: BodyArea[];
}

const AVOIDABLE: BodyArea[] = ["shoulders", "knees", "back", "wrists"];

function pickEnergy(rng: Rng): Energy {
  const r = rng();
  if (r < 0.15) return "low";
  if (r < 0.75) return "okay";
  return "strong";
}

function pickDays(rng: Rng, count: number): number[] {
  const days = [0, 1, 2, 3, 4, 5, 6];
  for (let i = days.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = days[i] as number;
    days[i] = days[j] as number;
    days[j] = a;
  }
  return days.slice(0, count).sort((a, b) => a - b);
}

/** The sessions a persona attempts in one week, in day order. */
export function weekPlan(persona: PersonaId, rng: Rng): PersonaDay[] {
  switch (persona) {
    case "consistent4":
    case "experienced":
      return [0, 1, 3, 5].map((day) => ({
        day,
        minutes: rng() < 0.6 ? 30 : 20,
        energy: pickEnergy(rng),
        quiet: rng() < 0.2,
        avoid: [],
      }));
    case "consistent2":
      return [1, 4].map((day) => ({
        day,
        minutes: rng() < 0.7 ? 20 : 30,
        energy: pickEnergy(rng),
        quiet: rng() < 0.2,
        avoid: [],
      }));
    case "lowCapability2":
      return [1, 4].map((day) => ({
        day,
        minutes: rng() < 0.7 ? 20 : 30,
        energy: pickEnergy(rng),
        quiet: rng() < 0.2,
        avoid: [],
      }));
    case "erratic": {
      const n = Math.floor(rng() * 5); // 0..4
      return pickDays(rng, n).map((day) => {
        const r = rng();
        const minutes: SessionMinutes = r < 0.3 ? 10 : r < 0.7 ? 20 : 30;
        const avoid: BodyArea[] =
          rng() < 0.1
            ? [AVOIDABLE[Math.floor(rng() * AVOIDABLE.length)] as BodyArea]
            : [];
        return { day, minutes, energy: pickEnergy(rng), quiet: rng() < 0.3, avoid };
      });
    }
    case "quiet":
      return [0, 2, 4].map((day) => ({
        day,
        minutes: 20 as SessionMinutes,
        energy: pickEnergy(rng),
        quiet: true,
        avoid: [],
      }));
    case "tenMin":
      return [0, 2, 4, 6].map((day) => ({
        day,
        minutes: 10 as SessionMinutes,
        energy: pickEnergy(rng),
        quiet: rng() < 0.2,
        avoid: [],
      }));
  }
}

// ---------- Struggle model ----------
//
// Each simulated user has a hidden per-pattern capability that grows with
// training. She struggles when prescribed above her capability — not at
// random — and the engine's volume-reduced soft landing makes the work
// meaningfully easier (-0.6 effective tier). That is why regressions only
// ever threaten genuinely over-tiered users, which earned advancement
// (3 clean sessions) prevents.

export const CAPABILITY_START_BASE = 1.0;
export const CAPABILITY_START_SPREAD = 0.5;
// Three clean sessions (one advancement) must grow capability by close to
// one tier step, else the gap compounds tier over tier and the soft
// landing stops covering it: with 0.3/clean the worst-case post-advance
// gap is 0.1 x (tier - 1) <= 0.5, inside VOLUME_REDUCED_RELIEF.
export const CAPABILITY_GAIN_COMPLETED = 0.3;
export const CAPABILITY_GAIN_STRUGGLED = 0.15;
/**
 * The experienced persona's starting capability on push and squat
 * (ADR-0026): already around tier 3, so a one-set taste of tier 2 and
 * then tier 3 is comfortably inside her range. Her other patterns start
 * at the ordinary base.
 */
export const EXPERIENCED_START_BASE = 3.0;
export const EXPERIENCED_START_SPREAD = 0.5;
export const EXPERIENCED_PATTERNS: readonly Pattern[] = ["push", "squat"];
export const LOW_CAPABILITY_START_BASE = 0.65;
export const LOW_CAPABILITY_START_SPREAD = 0.2;
export const LOW_CAPABILITY_GAIN_COMPLETED = 0.28;
export const LOW_CAPABILITY_GAIN_STRUGGLED = 0.12;
export const VOLUME_REDUCED_RELIEF = 0.6;
export const STRUGGLE_FLOOR = 0.01;
export const SKIP_PROB = 0.005;

export type Capability = Record<Pattern, number>;

export function initialCapability(rng: Rng, persona: PersonaId): Capability {
  const lowCapability = persona === "lowCapability2";
  const base = lowCapability
    ? LOW_CAPABILITY_START_BASE
    : CAPABILITY_START_BASE;
  const spread = lowCapability
    ? LOW_CAPABILITY_START_SPREAD
    : CAPABILITY_START_SPREAD;
  const one = () => base + rng() * spread;
  const capability: Capability = {
    push: one(),
    pull: one(),
    squat: one(),
    hinge: one(),
    core: one(),
  };
  if (persona === "experienced") {
    // Drawn after the ordinary five so the RNG stream stays aligned with
    // every other persona's first draws.
    for (const pattern of EXPERIENCED_PATTERNS) {
      capability[pattern] =
        EXPERIENCED_START_BASE + rng() * EXPERIENCED_START_SPREAD;
    }
  }
  return capability;
}

export function capabilityGain(
  persona: PersonaId,
  outcome: "completed" | "struggled",
): number {
  if (persona === "lowCapability2") {
    return outcome === "completed"
      ? LOW_CAPABILITY_GAIN_COMPLETED
      : LOW_CAPABILITY_GAIN_STRUGGLED;
  }
  return outcome === "completed"
    ? CAPABILITY_GAIN_COMPLETED
    : CAPABILITY_GAIN_STRUGGLED;
}

export function blockOutcome(
  rng: Rng,
  movement: Movement,
  state: PatternState,
  capability: number,
): BlockOutcome {
  const relief = state.volumeReduced ? VOLUME_REDUCED_RELIEF : 0;
  const gap = movement.tier - relief - capability;
  // The volume-reduced soft landing works: less volume of a movement she
  // already proved (3 clean sessions at the tier below) gets completed.
  // Bad-day noise applies only to full-volume prescriptions.
  if (state.volumeReduced && gap <= 0) return "completed";
  if (rng() < SKIP_PROB) return "skipped";
  const p =
    gap <= 0 ? STRUGGLE_FLOOR : Math.min(0.5, STRUGGLE_FLOOR + 0.4 * gap);
  return rng() < p ? "struggled" : "completed";
}
