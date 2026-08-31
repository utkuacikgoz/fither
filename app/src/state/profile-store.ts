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
      applyEngineResult: (result) => {
        set({ profile: result.profile, history: result.history });
        useLedgerStore.getState().append(result.ledgerEvents);
      },
    }),
    {
      name: "fither/profile-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ profile: state.profile, history: state.history }),
    },
  ),
);
