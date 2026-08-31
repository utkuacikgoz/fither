import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LedgerEvent } from "@fither/engine";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface LedgerState {
  /**
   * APPEND-ONLY. Points are only ever added (gamification rules); there is
   * deliberately no action that removes or edits events. Events come
   * exclusively from the engine's ApplyResult.
   */
  events: LedgerEvent[];
  append: (events: LedgerEvent[]) => void;
}

export const useLedgerStore = create<LedgerState>()(
  persist(
    (set) => ({
      events: [],
      append: (events) =>
        set((state) => ({ events: [...state.events, ...events] })),
    }),
    {
      name: "fither/ledger-v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Display math over engine-issued events; no rules here. */
export function totalPoints(events: LedgerEvent[]): number {
  return events.reduce((sum, e) => sum + e.points, 0);
}
