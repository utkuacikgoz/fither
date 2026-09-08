// The PostHog adapter (ADR-0015). Configured lazily on the first event,
// only when a public project key is present. Everything PostHog can do
// beyond capturing our four events is switched off: no autocapture, no
// lifecycle events, no feature flags, no surveys, no session replay, no
// geolocation. The SDK queues events in AsyncStorage and flushes when it
// can — airplane mode costs nothing and loses nothing.
//
// Identity: PostHog's anonymous distinct id until she signs in with
// Apple; then identify() with the one-way hash from analytics/identity.ts
// (owner decision 2026-09-08: she counts once across devices). The Apple
// provider id, name and email never reach the vendor.

import PostHog from "posthog-react-native";

import type { AnalyticsPort } from "./analytics";

/** Public project key; undefined means "use the dev adapter". */
const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
/** US cloud unless the project was created in the EU. */
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export function postHogConfigured(): boolean {
  return typeof API_KEY === "string" && API_KEY.length > 0;
}

let client: PostHog | null = null;

function ensureClient(): PostHog | null {
  if (client || !API_KEY) return client;
  client = new PostHog(API_KEY, {
    host: HOST,
    // Application Opened / Backgrounded, with from_background: the
    // return-visit signal the drop-off funnels start from.
    captureAppLifecycleEvents: true,
    disableGeoip: true,
    preloadFeatureFlags: false,
    sendFeatureFlagEvent: false,
    disableRemoteConfig: true,
    disableSurveys: true,
    enableSessionReplay: false,
    flushAt: 5,
    flushInterval: 10_000,
  });
  return client;
}

export const postHogAnalytics: AnalyticsPort = {
  track(name, properties) {
    try {
      ensureClient()?.capture(name, properties);
    } catch {
      // Never surfaces: a lost event is the worst case by design.
    }
  },
  identify(distinctId) {
    try {
      ensureClient()?.identify(distinctId);
    } catch {
      // Never let analytics break a screen.
    }
  },
  alias(distinctId) {
    try {
      ensureClient()?.alias(distinctId);
    } catch {
      // Never let analytics break a screen.
    }
  },
  setPersonProperties(properties) {
    try {
      // $set on the person, carried by a dedicated event so it applies
      // without waiting for the next capture.
      ensureClient()?.capture("$set", { $set: properties });
    } catch {
      // Never let analytics break a screen.
    }
  },
  reset() {
    try {
      ensureClient()?.reset();
    } catch {
      // As above.
    }
  },
};

/** Test helper: forget the configured client. */
export function resetPostHogForTests(): void {
  client = null;
}
