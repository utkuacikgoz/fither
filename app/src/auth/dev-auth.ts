// DEV-ONLY auth implementation (ADR-0011 §3): instant success, zero
// network, zero SDK. It exists so the whole sign-in flow — Apple,
// guest, sign-out, the error path — is fully clickable before real
// providers are wired. Its one piece of state is a persisted fake
// "session" that plays the role of the provider-side credential, using
// the same hydration-gated store pattern as dev-billing's receipt.
// Excluded from release the same way dev-billing is; deleted wholesale
// when the real adapters land.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { todayIso } from "../lib/dates";
import type {
  AuthPort,
  AuthProvider,
  IdentityKind,
  IdentityRecord,
  SignInOutcome,
} from "./auth";

interface DevAuthSessionState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** The fake provider-side credential. */
  session: IdentityRecord | null;
  setSession: (session: IdentityRecord | null) => void;
}

export const useDevAuthSessionStore = create<DevAuthSessionState>()(
  persist(
    (set) => ({
      session: null,
      hydrated: false,
      hydrationFailed: false,
      setSession: (session) => set({ session }),
    }),
    {
      name: "fither/dev-auth-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ session: state.session }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useDevAuthSessionStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);

/** Resolves once the session store has settled (sign-in may run early). */
function sessionReady(): Promise<void> {
  const { hydrated, hydrationFailed } = useDevAuthSessionStore.getState();
  // Settled either way — a store already in the failed state will never
  // emit another change, so waiting on the subscription would hang.
  if (hydrated || hydrationFailed) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useDevAuthSessionStore.subscribe((state) => {
      if (state.hydrated || state.hydrationFailed) {
        unsubscribe();
        resolve();
      }
    });
  });
}

async function signInAs(kind: IdentityKind): Promise<SignInOutcome> {
  await sessionReady();
  // The dev stand-in for a provider failure: the session store's own
  // hydration failed. Exercises the screen's calm error path.
  if (useDevAuthSessionStore.getState().hydrationFailed) {
    return { ok: false, reason: "failed" };
  }
  const identity: IdentityRecord = { kind, date: todayIso() };
  useDevAuthSessionStore.getState().setSession(identity);
  return { ok: true, identity };
}

export const devAuth: AuthPort = {
  currentIdentity(): IdentityRecord | null {
    return useDevAuthSessionStore.getState().session;
  },

  availableProviders(): AuthProvider[] {
    return ["apple"];
  },

  async checkRevoked() {
    return false;
  },

  signInWithApple(): Promise<SignInOutcome> {
    return signInAs("apple");
  },


  async continueAsGuest(): Promise<SignInOutcome> {
    // Guest is local-only and never fails (ADR-0011 §1) — the error
    // copy's "continue without an account" promise must always hold, so
    // this path does not depend on the fake session's health.
    const identity: IdentityRecord = { kind: "guest", date: todayIso() };
    await sessionReady();
    useDevAuthSessionStore.getState().setSession(identity);
    return { ok: true, identity };
  },

  async signOut(): Promise<void> {
    await sessionReady();
    useDevAuthSessionStore.getState().setSession(null);
  },
};
