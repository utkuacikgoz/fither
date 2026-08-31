import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Equipment } from "@fither/engine";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SettingsState {
  /** Equipment available to the user. Feeds the daily prompt as-is. */
  equipment: Equipment[];
  /**
   * Per-user salt for session seeds (seed = hash(date + salt)). Generated
   * once on first launch, persisted forever. App-side randomness is fine;
   * the engine only ever sees the resulting seed.
   */
  sessionSalt: number;
  setEquipment: (equipment: Equipment[]) => void;
}

function generateSalt(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // A wall and a chair exist in almost every home; bodyweight always.
      equipment: ["none", "chair", "wall"],
      sessionSalt: generateSalt(),
      setEquipment: (equipment) => set({ equipment }),
    }),
    {
      name: "fither/settings-v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
