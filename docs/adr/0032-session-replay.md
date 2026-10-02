# ADR-0032: Masked session replay in Sentry

- Status: accepted
- Date: 2026-10-02
- Refines: ADR-0016 (crash reporting: errors only, no attachments)

## Context

App Review's purchase failed on build 7 and nothing on our side showed
what the reviewer did before it. The owner asked for Sentry's session
replay. The product's privacy promise is that her notes, her daily
answers and the areas she works around stay on the phone; a replay that
captured text would break that promise.

## Decision

1. `mobileReplayIntegration` is on in the Sentry adapter
   (`app/src/monitoring/sentry-monitoring.ts`), with **every** mask on:
   `maskAllText`, `maskAllImages`, `maskAllVectors`. A replay is a
   wireframe: which screen, where she tapped, how long. Never a word on
   screen.
2. Sampling: 10% of sessions (`replaysSessionSampleRate: 0.1`) and every
   session that reports an error (`replaysOnErrorSampleRate: 1.0`).
3. Everything else in ADR-0016 stands: no `setUser`, `sendDefaultPii`
   false, `beforeSend` strips user and request, no tracing, no
   screenshots, no view hierarchy. The DSN still comes only from
   `EXPO_PUBLIC_SENTRY_DSN`.
4. Disclosed: the privacy policy's crash-report section says replays
   exist, are masked and sampled; the App Store privacy answers keep
   Sentry under Diagnostics, not used for tracking.

## Consequences

- The replay SDK is native: it ships in the next build, not build 7.
- Unmasking anything (a screen, a component) is a change to this ADR
  first, and never on a screen that shows her own words.
