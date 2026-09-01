// Her private notes from heavy days — the optional "want to say what
// happened?" moment. LOCAL ONLY, as a hard rule: entries persist to
// AsyncStorage on this device and never go anywhere else — no network,
// no analytics event, no engine input, no rendering back into any later
// screen. Append-only, one date-stamped entry per save. The UI states
// "stays on your phone" because this file makes it true.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface CareNoteEntry {
  /** YYYY-MM-DD, the same local-date source the daily prompt uses. */
  date: string;
  text: string;
}

interface CareNoteState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** Append-only, oldest first. Never trimmed, never edited. */
  entries: CareNoteEntry[];
  /** Append one entry. Buffered if hydration hasn't landed yet. */
  append: (entry: CareNoteEntry) => void;
}

// An append that beats hydration waits here instead of racing the
// rehydrate merge (same pattern as the first-movement store).
const pendingBeforeHydration: CareNoteEntry[] = [];

export const useCareNoteStore = create<CareNoteState>()(
  persist(
    (set, get) => ({
      entries: [],
      hydrated: false,
      hydrationFailed: false,

      append: (entry) => {
        const { hydrated, hydrationFailed, entries } = get();
        if (!hydrated && !hydrationFailed) {
          pendingBeforeHydration.push(entry);
          return;
        }
        set({ entries: [...entries, entry] });
      },
    }),
    {
      name: "fither/care-notes-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ entries: state.entries }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() => {
          const flushed = pendingBeforeHydration.splice(0);
          useCareNoteStore.setState((state) => ({
            hydrated: !error,
            hydrationFailed: Boolean(error),
            entries: [...state.entries, ...flushed],
          }));
        });
      },
    },
  ),
);
