// Persisted Gate 3 recordings: one open-to-first-movement run per app
// launch, captured at the session store's dispatch boundary. Local-only
// measurement plumbing — never analytics, never network — and written to
// AsyncStorage only when a capture actually lands (at most once per
// launch), never on countdown ticks. Read exclusively by the __DEV__
// timing readout.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { appendRun, type FirstMovementRun } from "../lib/first-movement-timer";

interface FirstMovementState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** Recorded launches, oldest first. Trimmed by appendRun's cap. */
  runs: FirstMovementRun[];
  /** Append one captured run. Buffered if hydration hasn't landed yet. */
  record: (run: FirstMovementRun) => void;
  /** Dev-only reset so each Gate 3 tester starts clean, no reinstall. */
  resetForDev: () => void;
}

// A capture that beats hydration (possible: this store hydrates in
// parallel with the gating stores, not among them) waits here instead of
// racing the rehydrate merge. At most one entry per launch by design.
const pendingBeforeHydration: FirstMovementRun[] = [];

export const useFirstMovementStore = create<FirstMovementState>()(
  persist(
    (set, get) => ({
      runs: [],
      hydrated: false,
      hydrationFailed: false,

      record: (run) => {
        const { hydrated, hydrationFailed, runs } = get();
        if (!hydrated && !hydrationFailed) {
          pendingBeforeHydration.push(run);
          return;
        }
        set({ runs: appendRun(runs, run) });
      },

      resetForDev: () => set({ runs: [] }),
    }),
    {
      name: "fither/first-movement-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ runs: state.runs }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() => {
          const flushed = pendingBeforeHydration.splice(0);
          useFirstMovementStore.setState((state) => ({
            hydrated: !error,
            hydrationFailed: Boolean(error),
            runs: flushed.reduce((runs, run) => appendRun(runs, run), state.runs),
          }));
        });
      },
    },
  ),
);
