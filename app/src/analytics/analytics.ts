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
import type { AnalyticsEventName, AnalyticsEvents } from "./events";
import { postHogAnalytics, postHogConfigured } from "./posthog-analytics";

export interface AnalyticsPort {
  /** Send one event. Must never throw and never wait on the network. */
  track<N extends AnalyticsEventName>(name: N, properties: AnalyticsEvents[N]): void;
  /** Forget the anonymous id — sign-out and the dev first-run reset. */
  reset(): void;
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
