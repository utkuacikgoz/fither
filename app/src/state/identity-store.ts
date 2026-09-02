// The app-side identity record (ADR-0011). Canonical for the one
// first-run gate (show the sign-in screen only while no identity exists)
// and evaluated fully offline. Identity gates NOTHING on the training
// path — session generation, entitlements, points and skills never
// consult it. Writes land here only through the auth port; remembered
// until the dev full first-run reset clears it.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getAuth, type IdentityRecord } from "../auth/auth";

interface IdentityStoreState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** Who she is: guest or a provider identity. Null = none yet. */
  identity: IdentityRecord | null;
  /** Sign in through the auth port and persist the identity. */
  signInWithApple: () => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  /** The first-class guest path (ADR-0011 §1). Never fails. */
  continueAsGuest: () => Promise<boolean>;
  /** Clear the identity here and at the provider. */
  signOut: () => Promise<void>;
}

export const useIdentityStore = create<IdentityStoreState>()(
  persist(
    (set) => ({
      identity: null,
      hydrated: false,
      hydrationFailed: false,

      signInWithApple: async () => {
        const outcome = await getAuth().signInWithApple();
        if (!outcome.ok) return false;
        set({ identity: outcome.identity });
        return true;
      },

      signInWithGoogle: async () => {
        const outcome = await getAuth().signInWithGoogle();
        if (!outcome.ok) return false;
        set({ identity: outcome.identity });
        return true;
      },

      continueAsGuest: async () => {
        const outcome = await getAuth().continueAsGuest();
        if (!outcome.ok) return false;
        set({ identity: outcome.identity });
        return true;
      },

      signOut: async () => {
        await getAuth().signOut();
        set({ identity: null });
      },
    }),
    {
      name: "fither/identity-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ identity: state.identity }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useIdentityStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);
