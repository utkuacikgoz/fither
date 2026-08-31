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
  | "erratic"
  | "quiet"
  | "tenMin";

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
export const VOLUME_REDUCED_RELIEF = 0.6;
export const STRUGGLE_FLOOR = 0.01;
export const SKIP_PROB = 0.005;

export type Capability = Record<Pattern, number>;

export function initialCapability(rng: Rng): Capability {
  const one = () => CAPABILITY_START_BASE + rng() * CAPABILITY_START_SPREAD;
  return { push: one(), pull: one(), squat: one(), hinge: one(), core: one() };
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
