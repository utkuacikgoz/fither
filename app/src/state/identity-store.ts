// The app-side identity record (ADR-0011). Canonical for the one
// first-run gate (show the sign-in screen only while no identity exists)
// and evaluated fully offline. Identity gates NOTHING on the training
// path — session generation, entitlements, points and skills never
// consult it. Writes land here only through the auth port; remembered
// until the dev full first-run reset clears it.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getAnalytics, identify, track } from "../analytics/analytics";
import { analyticsDistinctId } from "../analytics/identity";
import { getAuth, type IdentityRecord } from "../auth/auth";
import { getBilling } from "../monetization/billing";

/** What a sign-in attempt meant: landed, she dismissed the sheet, or it failed. */
export type SignInResult = "done" | "cancelled" | "failed";

interface IdentityStoreState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** Who she is: guest or a provider identity. Null = none yet. */
  identity: IdentityRecord | null;
  /** Sign in through the auth port and persist the identity. */
  signInWithApple: () => Promise<SignInResult>;
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

/**
 * Make the analytics person hers across devices — as the one-way hash
 * of the provider id (analytics/identity.ts), never the id itself.
 */
function identifyIfApple(identity: IdentityRecord): void {
  if (identity.kind === "apple" && identity.providerUserId) {
    const distinctId = analyticsDistinctId(identity.providerUserId);
    identify(distinctId);
    // The store customer is the same person (ADR-0027 §3): its
    // server-side purchase events land on her. Never awaited; a store
    // refusal changes nothing here.
    void getBilling().setUser(distinctId);
  }
}

export const useIdentityStore = create<IdentityStoreState>()(
  persist(
    (set, get) => ({
      identity: null,
      hydrated: false,
      hydrationFailed: false,

      signInWithApple: async () => {
        const outcome = await getAuth().signInWithApple();
        // sign_in_result: how the provider's sheet ended, in its own
        // words (done / cancelled / failed) — never anything about her.
        track("sign_in_result", {
          method: "apple",
          outcome: outcome.ok ? "done" : outcome.reason,
        });
        if (!outcome.ok) return outcome.reason;
        set({ identity: outcome.identity });
        identifyIfApple(outcome.identity);
        return "done";
      },

      continueAsGuest: async () => {
        const outcome = await getAuth().continueAsGuest();
        track("sign_in_result", {
          method: "guest",
          outcome: outcome.ok ? "done" : outcome.reason,
        });
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
        // account_action goes out under HER id, before the reset below
        // hands the phone a new anonymous one: whoever signs in next is
        // not stitched to her.
        track("account_action", { action: "signOut" });
        getAnalytics().reset();
        void getBilling().clearUser();
      },
    }),
    {
      name: "fither/identity-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ identity: state.identity }),
      onRehydrateStorage: () => (state, error) => {
        // A remembered Apple identity re-identifies at every launch:
        // idempotent on the platform, and it is what keeps her one
        // person after a reinstall. Guest and legacy records carry no
        // provider id and identify nothing.
        if (!error && state?.identity) identifyIfApple(state.identity);
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
