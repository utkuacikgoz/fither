import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DailyPrompt, Session } from "@fither/engine";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PlayerState } from "../session/player-machine";

/**
 * Crash-safe copy of the in-flight session. The session store writes a
 * snapshot here at meaningful player moments (never on countdown ticks —
 * see dispatchPlayer in session-store.ts) so a relaunch can offer to
 * resume today's session instead of discarding her work. Cleared when the
 * session is applied or explicitly discarded.
 */
export interface ActiveSessionSnapshot {
  prompt: DailyPrompt;
  session: Session;
  /** Full machine state: blocks with display info, phase, outcomes so far. */
  player: PlayerState;
}

interface ActiveSessionState {
  hydrated: boolean;
  hydrationFailed: boolean;
  snapshot: ActiveSessionSnapshot | null;
  save: (snapshot: ActiveSessionSnapshot) => void;
  clear: () => void;
}

export const useActiveSessionStore = create<ActiveSessionState>()(
  persist(
    (set) => ({
      snapshot: null,
      hydrated: false,
      hydrationFailed: false,
      save: (snapshot) => set({ snapshot }),
      clear: () => set({ snapshot: null }),
    }),
    {
      name: "fither/active-session-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ snapshot: state.snapshot }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useActiveSessionStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);
