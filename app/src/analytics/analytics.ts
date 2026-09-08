// The analytics port (same shape as the billing, auth and notifications
// ports). Screens and stores call track(); nothing else in the app knows
// the vendor. Two rules hold by construction (fither-code "Ops stack"):
//
// - Analytics never blocks or gates anything. track() is synchronous,
//   fire-and-forget, and swallows every failure — a throwing adapter, an
//   unreachable network, airplane mode — so a workout is never one
//   analytics call away from breaking.
// - Only the events in ./events.ts can be sent; the types make anything
//   else a compile error.
//
// The PostHog adapter is selected only when its public key is configured
// (EXPO_PUBLIC_POSTHOG_KEY, see docs/posthog-setup.md); otherwise the dev
// adapter records events in memory, which is what tests read.

import { devAnalytics } from "./dev-analytics";
import type { AnalyticsEventName, AnalyticsEvents, PersonProperties } from "./events";
import { postHogAnalytics, postHogConfigured } from "./posthog-analytics";

export interface AnalyticsPort {
  /** Send one event. Must never throw and never wait on the network. */
  track<N extends AnalyticsEventName>(name: N, properties: AnalyticsEvents[N]): void;
  /** Forget the anonymous id — sign-out and the dev first-run reset. */
  reset(): void;
  /**
   * Make this phone's events hers across devices: the distinct id becomes
   * the given value (already a one-way hash, analytics/identity.ts). The
   * anonymous events before it are stitched by the platform.
   */
  identify(distinctId: string): void;
  /** Facts about the person, replacing the previous values of those keys. */
  setPersonProperties(properties: Partial<PersonProperties>): void;
  /**
   * Another system's id for the same person (the store's anonymous
   * customer id), so its server-side events land on her.
   */
  alias(distinctId: string): void;
}

/** The active analytics implementation. */
export function getAnalytics(): AnalyticsPort {
  return postHogConfigured() ? postHogAnalytics : devAnalytics;
}

/**
 * The one call sites use. Guarded here as well as in the adapters, so a
 * bug in either adapter can only ever lose an event, never a session.
 */
export function track<N extends AnalyticsEventName>(
  name: N,
  properties: AnalyticsEvents[N],
): void {
  try {
    getAnalytics().track(name, properties);
  } catch {
    // Deliberately silent: analytics is never allowed to surface.
  }
}

/** Identify, guarded like track: an adapter bug can only ever lose the link. */
export function identify(distinctId: string): void {
  try {
    getAnalytics().identify(distinctId);
  } catch {
    // Never let analytics break a screen.
  }
}

/** Alias, guarded like track. */
export function alias(distinctId: string): void {
  try {
    getAnalytics().alias(distinctId);
  } catch {
    // Never let analytics break a screen.
  }
}

/** Person properties, guarded like track. */
export function setPersonProperties(properties: Partial<PersonProperties>): void {
  try {
    getAnalytics().setPersonProperties(properties);
  } catch {
    // Never let analytics break a screen.
  }
}
