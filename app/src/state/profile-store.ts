import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createInitialProfile,
  type ApplyResult,
  type History,
  type Profile,
} from "@fither/engine";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useLedgerStore } from "./ledger-store";

interface ProfileState {
  profile: Profile;
  history: History;
  hydrated: boolean;
  hydrationFailed: boolean;
  /**
   * The ONLY way profile/history/ledger change: the engine's ApplyResult.
   * The app never computes progression itself.
   */
  applyEngineResult: (result: ApplyResult) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      // The zero-state comes from the engine, not the app.
      profile: createInitialProfile(),
      history: { entries: [] },
      hydrated: false,
      hydrationFailed: false,
      applyEngineResult: (result) => {
        set({ profile: result.profile, history: result.history });
        useLedgerStore.getState().append(result.ledgerEvents);
      },
    }),
    {
      name: "fither/profile-v1",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // v0 → v1 (S2 rename): the engine's PatternState fields renamed
      // cleanStreak → cleanCount and struggledStreak → struggleCount; the
      // engine stays single-shaped (no legacy tolerance), so profiles
      // persisted before the rename are mapped here, values untouched.
      migrate: (persisted) => {
        const state = persisted as {
          profile?: { patterns?: Record<string, Record<string, unknown>> };
        };
        const patterns = state?.profile?.patterns;
        if (patterns) {
          for (const pattern of Object.values(patterns)) {
            if ("cleanStreak" in pattern && !("cleanCount" in pattern)) {
              pattern.cleanCount = pattern.cleanStreak;
              delete pattern.cleanStreak;
            }
            if ("struggledStreak" in pattern && !("struggleCount" in pattern)) {
              pattern.struggleCount = pattern.struggledStreak;
              delete pattern.struggledStreak;
            }
          }
        }
        return state;
      },
      partialize: (state) => ({ profile: state.profile, history: state.history }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useProfileStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);
