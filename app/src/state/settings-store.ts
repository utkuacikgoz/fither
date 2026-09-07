import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BodyArea, Equipment } from "@fither/engine";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SettingsState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** Equipment available to the user. Feeds the daily prompt as-is. */
  equipment: Equipment[];
  /**
   * Onboarding ran to the end once (ADR-0009 §1). Persisted so relaunch
   * skips it; a profile with history also skips it even without the flag
   * (pre-onboarding installs are never re-onboarded).
   */
  onboardingCompleted: boolean;
  /**
   * Persistent avoid-list from onboarding: areas to ALWAYS work around,
   * distinct from the daily (transient) soreness answer. Merged into
   * every prompt's avoid list before it reaches the engine.
   */
  alwaysAvoid: BodyArea[];
  /**
   * Per-user salt for session seeds (seed = hash(date + salt)). Generated
   * once on first launch, persisted forever. App-side randomness is fine;
   * the engine only ever sees the resulting seed.
   */
  sessionSalt: number;
  setEquipment: (equipment: Equipment[]) => void;
  /** Persist the two onboarding answers and mark onboarding done. */
  completeOnboarding: (equipment: Equipment[], alwaysAvoid: BodyArea[]) => void;
  /**
   * Toggle one persistent avoid area (the settings screen's editor for
   * the onboarding list). Persists immediately via the store layer.
   */
  toggleAlwaysAvoid: (area: BodyArea) => void;
  /**
   * Replace the persistent avoid-list wholesale. The first session's
   * soreness step uses it when she chooses to remember today's picks for
   * every session (owner brief 2026-09-07: restrictions asked once).
   * Persists immediately via the store layer.
   */
  setAlwaysAvoid: (alwaysAvoid: BodyArea[]) => void;
  /**
   * Spoken cues during a session. OFF by default: audio she did not ask
   * for, on a first session at 6am next to a sleeping child, is the
   * wrong surprise — she turns it on in Settings. The quiet answer in
   * the daily prompt silences it regardless (player rule).
   */
  voice: boolean;
  setVoice: (voice: boolean) => void;
}

// The two equipment shapes the product offers — "Just me and the floor"
// vs "A sturdy chair too" (onboarding's one equipment question, and the
// settings editor's options; onboarding-screen keeps matching private
// copies). A wall exists in every room she'd train in, so it stays
// available on both paths; bodyweight always. Never mutate these.
export const FLOOR_ONLY_EQUIPMENT: Equipment[] = ["none", "wall"];
export const WITH_CHAIR_EQUIPMENT: Equipment[] = ["none", "chair", "wall"];

function generateSalt(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // A wall and a chair exist in almost every home; bodyweight always.
      equipment: WITH_CHAIR_EQUIPMENT,
      onboardingCompleted: false,
      alwaysAvoid: [],
      sessionSalt: generateSalt(),
      hydrated: false,
      hydrationFailed: false,
      voice: false,
      setVoice: (voice) => set({ voice }),
      setEquipment: (equipment) => set({ equipment }),
      completeOnboarding: (equipment, alwaysAvoid) =>
        set({ equipment, alwaysAvoid, onboardingCompleted: true }),
      setAlwaysAvoid: (alwaysAvoid) => set({ alwaysAvoid }),
      toggleAlwaysAvoid: (area) =>
        set((state) => ({
          alwaysAvoid: state.alwaysAvoid.includes(area)
            ? state.alwaysAvoid.filter((a) => a !== area)
            : [...state.alwaysAvoid, area],
        })),
    }),
    {
      name: "fither/settings-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        equipment: state.equipment,
        onboardingCompleted: state.onboardingCompleted,
        alwaysAvoid: state.alwaysAvoid,
        sessionSalt: state.sessionSalt,
        voice: state.voice,
      }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useSettingsStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);
