// The auth port (ADR-0011 §3). The app talks to sign-in ONLY through this
// interface; the identity store is the app-side record of who she is and
// is evaluated offline. The only implementation today is dev-auth
// (instant success, no network, no SDK). Wiring real Apple/Google sign-in
// later means implementing this same interface in a new adapter and
// switching `getAuth()` — nothing else changes. Identity gates NOTHING on
// the training path (ADR-0011 §4): signed out never means locked out.

import { devAuth } from "./dev-auth";
import { providerAuth } from "./provider-auth";

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
  /**
   * The provider's opaque, stable user id (Apple's `user`), kept only so
   * a revoked credential can be recognised at launch. Never shown, never
   * sent anywhere; absent for guest and for legacy records.
   */
  providerUserId?: string;
}

export type SignInOutcome =
  | { ok: true; identity: IdentityRecord }
  /** She dismissed the provider's sheet. Not an error; nothing to say. */
  | { ok: false; reason: "cancelled" }
  | { ok: false; reason: "failed" };

export interface AuthPort {
  /**
   * The provider's own view of the current identity, if it has one
   * cached. The app-side identity store stays canonical for offline
   * gating; this exists so a real adapter can be consulted
   * opportunistically.
   */
  currentIdentity(): IdentityRecord | null;
  /**
   * Which provider buttons may render. A provider without a real
   * adapter is not offered: a button that fakes success is a review
   * rejection and a lie. Guest is always available and not listed.
   * Synchronous on purpose: the answer is a property of the build (iOS
   * only, iOS 15.1+ floor), so the screen renders right on its first
   * frame instead of a lone guest button that grows a provider later.
   */
  availableProviders(): AuthProvider[];
  /**
   * Whether the provider has revoked this identity's credential (Apple
   * requires the app to notice). Unknown — offline, or a provider with
   * no such concept — answers false: signed out never means locked out,
   * and a network blip must not throw her back to sign-in.
   */
  checkRevoked(identity: IdentityRecord): Promise<boolean>;
  signInWithApple(): Promise<SignInOutcome>;
  signInWithGoogle(): Promise<SignInOutcome>;
  /** The guest path is local-only and always succeeds (ADR-0011 §1). */
  continueAsGuest(): Promise<SignInOutcome>;
  signOut(): Promise<void>;
}

/**
 * The active auth implementation: the real providers in release builds
 * (and in a dev build that opts in with EXPO_PUBLIC_AUTH=apple, so the
 * owner can walk the real Apple sheet), the dev adapter otherwise — so
 * every test and every ordinary dev build keeps the fully clickable,
 * no-network flow with all three buttons.
 */
export function getAuth(): AuthPort {
  const optIn = process.env.EXPO_PUBLIC_AUTH === "apple";
  return !__DEV__ || optIn ? providerAuth : devAuth;
}
