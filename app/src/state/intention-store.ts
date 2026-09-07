// The weekly intention (owner brief 2026-09-07, wave 2): two days a
// week, three days a week, or none. Two persisted facts, nothing more:
// which target she holds, and whether we have asked her once.
//
// Changing the target is PROSPECTIVE only. Nothing here is history:
// participation is a read of the engine's `weekParticipation` over the
// history the engine already writes, so a new target simply changes what
// the current and every later week are measured against. There is no
// past to rewrite — a week that met "2" and is now read against "3" is
// the same trained days either way; the engine's fold is the only record.
// Like every sibling, this store is local-only and works in airplane mode.

import type { WeeklyTarget } from "@fither/engine";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface IntentionState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** The intention she holds: 2 or 3 days a week, or none (null). */
  target: WeeklyTarget;
  /** The one intention ask has run (answered with a target OR declined). */
  asked: boolean;
  /**
   * Set (or clear) the target. Choosing is an answer, so this also marks
   * the ask as done — a target without `asked` would re-ask a question
   * she has already answered.
   */
  setTarget: (target: WeeklyTarget) => void;
  /** The ask ran and she chose nothing: never ask again, target unchanged. */
  markAsked: () => void;
}

export const useIntentionStore = create<IntentionState>()(
  persist(
    (set) => ({
      hydrated: false,
      hydrationFailed: false,
      target: null,
      asked: false,

      setTarget: (target) => set({ target, asked: true }),

      markAsked: () => set({ asked: true }),
    }),
    {
      name: "fither/intention-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        target: state.target,
        asked: state.asked,
      }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useIntentionStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);

/**
 * Whether the one intention ask is still owed. Requires hydration —
 * before the persisted `asked` is known we fail SAFE toward not asking;
 * a skipped ask costs nothing, a repeated one is a nag.
 */
export function intentionAskDue(): boolean {
  const state = useIntentionStore.getState();
  return state.hydrated && !state.asked;
}
