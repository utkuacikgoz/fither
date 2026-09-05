import * as AppleAuthentication from "expo-apple-authentication";

import { todayIso } from "../lib/dates";
import type { AuthPort, AuthProvider, IdentityRecord, SignInOutcome } from "./auth";

// The real providers behind the auth port (ADR-0011 §3). Apple is live;
// Google has no adapter yet and is therefore NOT offered — the port's
// availableProviders() is how the screen knows. Guest stays local and
// always succeeds.
//
// ADR-0011 §6 holds: no name, no email. The sign-in requests NO scopes;
// Apple still returns its opaque `user` id, which is kept only to notice
// a revoked credential at launch. The identity store is canonical and
// offline; this adapter is consulted at sign-in and, opportunistically,
// at launch.

const CANCELLED = "ERR_REQUEST_CANCELED";

export const providerAuth: AuthPort = {
  currentIdentity(): IdentityRecord | null {
    // Apple offers no cached identity; the identity store is the record.
    return null;
  },

  availableProviders(): AuthProvider[] {
    // Sign in with Apple exists on every iOS this app can install on
    // (platforms: ios, SDK floor iOS 15.1); isAvailableAsync() only says
    // no on other platforms. Google has no adapter yet.
    return ["apple"];
  },

  async checkRevoked(identity: IdentityRecord): Promise<boolean> {
    if (identity.kind !== "apple" || !identity.providerUserId) return false;
    try {
      const state = await AppleAuthentication.getCredentialStateAsync(
        identity.providerUserId,
      );
      return (
        state === AppleAuthentication.AppleAuthenticationCredentialState.REVOKED ||
        state === AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND
      );
    } catch {
      return false;
    }
  },

  async signInWithApple(): Promise<SignInOutcome> {
    try {
      const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
      return {
        ok: true,
        identity: { kind: "apple", date: todayIso(), providerUserId: credential.user },
      };
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      return { ok: false, reason: code === CANCELLED ? "cancelled" : "failed" };
    }
  },

  async signInWithGoogle(): Promise<SignInOutcome> {
    // Not offered (availableProviders); reaching here is a programming
    // error, answered honestly rather than faked.
    return { ok: false, reason: "failed" };
  },

  async continueAsGuest(): Promise<SignInOutcome> {
    return { ok: true, identity: { kind: "guest", date: todayIso() } };
  },

  async signOut(): Promise<void> {
    // Apple keeps no app-side session to end; the identity store clears.
  },
};
