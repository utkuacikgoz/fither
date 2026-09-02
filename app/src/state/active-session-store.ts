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
  /** Stable apply key. Optional only so pre-upgrade snapshots remain recoverable. */
  sessionId?: string;
  prompt: DailyPrompt;
  session: Session;
  /** Full machine state: blocks with display info, phase, outcomes so far. */
  player: PlayerState;
  /** Wall-clock end of the current countdown; null outside timed phases. */
  countdownEndsAt?: number | null;
  /**
   * ACTIVE training milliseconds banked so far — the time-budget ceiling
   * (ADR-0012 §2) spends this, never wall-clock-since-start. The session
   * store folds the live stretch into this number at every snapshot
   * write; on restore the away time is never counted (the live anchor
   * restarts at her next work dispatch). Absent on legacy snapshots —
   * see restoreActiveSession for the tolerant reading.
   */
  activeMs?: number;
  /**
   * @deprecated Pre-active-time snapshots carried a single wall-clock
   * anchor here. It is deliberately IGNORED on restore: counting hours
   * away as training would wrap her session the moment she resumed.
   * Banking nothing and re-anchoring at her next work dispatch is the
   * most generous reading, so it is the one we take. Kept in the type
   * only so persisted legacy JSON stays representable.
   */
  workStartedAt?: number | null;
  /**
   * An early close already decided for this session — "endedEarly" from
   * the resume offer's "Finish here", "outOfTime" from the time-budget
   * wrap — so a crash between the close and the apply still lands on the
   * same honest finish state. Null/absent: no early close.
   */
  pendingClose?: "endedEarly" | "outOfTime" | null;
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
