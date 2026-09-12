// The weekly recap handoff. At the start of a new week, Home can surface
// the previous week's real training once, until she opens or dismisses it.
// One Monday is stored, not a streak or score: this is quiet bookkeeping
// for a lifecycle moment, and it remains entirely on device.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { weeksParticipation, type HistoryEntry, type WeekParticipation } from "@fither/engine";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface RecapState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** Monday of the most recent previous week opened or dismissed on Home. */
  handledWeekStart: string | null;
  handle: (weekStart: string) => void;
}

export const useRecapStore = create<RecapState>()(
  persist(
    (set) => ({
      hydrated: false,
      hydrationFailed: false,
      handledWeekStart: null,
      handle: (handledWeekStart) => set({ handledWeekStart }),
    }),
    {
      name: "fither/recap-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ handledWeekStart: state.handledWeekStart }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useRecapStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);

/**
 * The previous week to surface on Home, if it contains training and has
 * not already been handled. The engine remains the only definition of a
 * trained session and calendar week.
 */
export function previousWeekRecapDue(
  entries: readonly HistoryEntry[],
  todayIso: string,
  handledWeekStart: string | null,
): WeekParticipation | null {
  const previous = weeksParticipation(entries, todayIso, 2)[0];
  if (!previous || previous.sessions === 0 || previous.start === handledWeekStart) {
    return null;
  }
  return previous;
}
