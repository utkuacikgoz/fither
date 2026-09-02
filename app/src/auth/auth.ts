// The auth port (ADR-0011 §3). The app talks to sign-in ONLY through this
// interface; the identity store is the app-side record of who she is and
// is evaluated offline. The only implementation today is dev-auth
// (instant success, no network, no SDK). Wiring real Apple/Google sign-in
// later means implementing this same interface in a new adapter and
// switching `getAuth()` — nothing else changes. Identity gates NOTHING on
// the training path (ADR-0011 §4): signed out never means locked out.

import { devAuth } from "./dev-auth";

/** The two providers (ADR-0011 §2): Apple and Google, nothing else. */
export type AuthProvider = "apple" | "google";

/**
 * How she continues: a provider identity or the first-class guest path.
 * "None" is represented as the absence of a record (null), never a kind.
 */
export type IdentityKind = AuthProvider | "guest";

/**
 * An identity as the app records it: the kind and the local ISO date it
 * was established. Nothing else — no name, no photo, no profile data
 * (ADR-0011 §6); sign-in yields an identity token and nothing more.
 */
export interface IdentityRecord {
  kind: IdentityKind;
  date: string;
}

export type SignInOutcome =
  | { ok: true; identity: IdentityRecord }
  | { ok: false; reason: "failed" };

export interface AuthPort {
  /**
   * The provider's own view of the current identity, if it has one
   * cached. The app-side identity store stays canonical for offline
   * gating; this exists so a real adapter can be consulted
   * opportunistically.
   */
  currentIdentity(): IdentityRecord | null;
  signInWithApple(): Promise<SignInOutcome>;
  signInWithGoogle(): Promise<SignInOutcome>;
  /** The guest path is local-only and always succeeds (ADR-0011 §1). */
  continueAsGuest(): Promise<SignInOutcome>;
  signOut(): Promise<void>;
}

/** The active auth implementation. Dev-only until real adapters land. */
export function getAuth(): AuthPort {
  return devAuth;
}
