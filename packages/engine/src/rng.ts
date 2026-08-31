import type { Rng } from "./types.js";

// Contract stub (ADR-0004): engine-engineer replaces the body. Mulberry32
// or similar — deterministic, seedable, zero deps.
export function createRng(seed: number): Rng {
  void seed;
  throw new Error("createRng: not implemented yet");
}
