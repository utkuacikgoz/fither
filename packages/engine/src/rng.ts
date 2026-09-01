import type { Rng } from "./types";

/**
 * Mulberry32 — deterministic, seedable, zero dependencies.
 * Same seed → identical stream, on every platform. The engine never
 * touches Math.random; all randomness flows through this.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
