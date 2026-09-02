// App-layer count of sessions that closed with the plain "completed"
// close — the rating prompt's gate (launch checklist: ask after
// experienced value, never at first open, never mid-session; owner
// decision: never on her FIRST ever completed session either). This is
// navigation policy, not training data: the engine's history stays the
// only record of training; this counter exists solely so the rating
// moment can tell "second completed session onward" across launches.
// Nothing here is a streak — the count only ever grows, is never shown,
// and missing days change nothing.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface RatingState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** How many sessions have ever closed as "completed". */
  completedCloses: number;
  /** Count one completed close (called once per finish-screen exit). */
  recordCompletedClose: () => void;
}

export const useRatingStore = create<RatingState>()(
  persist(
    (set) => ({
      hydrated: false,
      hydrationFailed: false,
      completedCloses: 0,
      recordCompletedClose: () =>
        set((state) => ({ completedCloses: state.completedCloses + 1 })),
    }),
    {
      name: "fither/rating-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ completedCloses: state.completedCloses }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useRatingStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);

/**
 * Whether a rating moment may fire: from the SECOND completed session
 * onward. Unhydrated reads say no — failing safe toward not prompting.
 */
export function ratingMomentReached(): boolean {
  const state = useRatingStore.getState();
  return state.hydrated && state.completedCloses >= 2;
}
