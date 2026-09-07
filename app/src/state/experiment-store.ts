// Experiment assignments (ADR-0025). One small persisted record: a random
// seed drawn ONCE on the first assignment and never replaced, and the
// variant each experiment was given from it. Assignment is a pure
// function of (seed, experiment id), so a recorded variant is stable
// across launches, reinstall-free updates and airplane mode. The seed is
// drawn here, on device — never from analytics, the network or her
// identity, so nothing about her selects a variant and nothing leaves
// the phone to make one. The record is in persisted-stores.ts, so the
// dev first-run reset and "erase everything" clear it with the rest.
//
// The policy that READS this (which experiment is on, what a variant
// means) lives in monetization/experiment.ts; this store only remembers.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { track } from "../analytics/analytics";
import { createJSONStorage, persist } from "zustand/middleware";

export const EXPERIMENTS_STORAGE_KEY = "fither/experiments-v1";

interface ExperimentStoreState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** The one random seed, drawn on the first assignment; null until then. */
  seed: number | null;
  /** Experiment id → the variant it was given. Written once per experiment. */
  assignments: Readonly<Record<string, string>>;
  /**
   * DEV-ONLY override, so the flow previewer can show either variant
   * without touching the production activation or the recorded
   * assignment. Read only under __DEV__ (monetization/experiment.ts).
   */
  forceVariant: string | null;
  /**
   * Assign `experimentId` one of `variants` from the seed (drawing the
   * seed first if none exists) and record it. A second call for the same
   * experiment returns the recorded variant unchanged.
   */
  assign: <V extends string>(experimentId: string, variants: readonly V[]) => V;
  setForceVariantForDev: (variant: string | null) => void;
  resetForDev: () => void;
}

function drawSeed(): number {
  // App layer, not the engine: Math.random is allowed here (the settings
  // store's session salt is drawn the same way).
  return Math.floor(Math.random() * 0x7fffffff);
}

/**
 * A small, deterministic hash of the seed and the experiment id (FNV-1a
 * over the string, then a murmur3-style finalizer so the low bits mix —
 * FNV alone leaves the low bit as plain character parity), so two
 * experiments on one phone are not the same coin flip. Plain
 * arithmetic: no dependency, identical on every platform and in tests.
 */
export function variantIndex(seed: number, experimentId: string, count: number): number {
  const input = `${experimentId}:${seed}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return (hash >>> 0) % count;
}

export const useExperimentStore = create<ExperimentStoreState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      hydrationFailed: false,
      seed: null,
      assignments: {},
      forceVariant: null,

      assign: (experimentId, variants) => {
        const recorded = get().assignments[experimentId];
        const existing = variants.find((variant) => variant === recorded);
        if (existing !== undefined) return existing;
        const seed = get().seed ?? drawSeed();
        const variant = variants[variantIndex(seed, experimentId, variants.length)];
        if (variant === undefined) {
          throw new Error(`experiment ${experimentId} has no variants`);
        }
        set((state) => ({
          seed,
          assignments: { ...state.assignments, [experimentId]: variant },
        }));
        // experiment_exposure (ADR-0024 §3): the one moment a variant is
        // assigned, once per experiment on this phone.
        const exposed: string = variant;
        if (experimentId === "free_sessions_v1" && (exposed === "control" || exposed === "three")) {
          track("experiment_exposure", { experiment: "free_sessions_v1", variant: exposed });
        }
        return variant;
      },

      setForceVariantForDev: (variant) => set({ forceVariant: variant }),

      resetForDev: () => set({ seed: null, assignments: {}, forceVariant: null }),
    }),
    {
      name: EXPERIMENTS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        seed: state.seed,
        assignments: state.assignments,
        forceVariant: state.forceVariant,
      }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useExperimentStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);
