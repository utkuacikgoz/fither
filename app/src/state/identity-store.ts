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

/** What a sign-in attempt meant: landed, she dismissed the sheet, or it failed. */
export type SignInResult = "done" | "cancelled" | "failed";

interface IdentityStoreState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** Who she is: guest or a provider identity. Null = none yet. */
  identity: IdentityRecord | null;
  /** Sign in through the auth port and persist the identity. */
  signInWithApple: () => Promise<SignInResult>;
  signInWithGoogle: () => Promise<SignInResult>;
  /** The first-class guest path (ADR-0011 §1). Never fails. */
  continueAsGuest: () => Promise<SignInResult>;
  /**
   * Ask the provider whether this identity's credential was revoked
   * and, if so, forget it — she sees sign-in again, with her record
   * untouched (identity gates nothing on the training path). Unknown
   * changes nothing. Called at launch, fire-and-forget.
   */
  refreshFromProvider: () => Promise<void>;
  /** Clear the identity here and at the provider. */
  signOut: () => Promise<void>;
}

export const useIdentityStore = create<IdentityStoreState>()(
  persist(
    (set, get) => ({
      identity: null,
      hydrated: false,
      hydrationFailed: false,

      signInWithApple: async () => {
        const outcome = await getAuth().signInWithApple();
        if (!outcome.ok) return outcome.reason;
        set({ identity: outcome.identity });
        return "done";
      },

      signInWithGoogle: async () => {
        const outcome = await getAuth().signInWithGoogle();
        if (!outcome.ok) return outcome.reason;
        set({ identity: outcome.identity });
        return "done";
      },

      continueAsGuest: async () => {
        const outcome = await getAuth().continueAsGuest();
        if (!outcome.ok) return outcome.reason;
        set({ identity: outcome.identity });
        return "done";
      },

      refreshFromProvider: async () => {
        const { identity } = get();
        if (!identity) return;
        if (await getAuth().checkRevoked(identity)) set({ identity: null });
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
