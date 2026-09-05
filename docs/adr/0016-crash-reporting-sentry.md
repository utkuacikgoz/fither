# ADR-0016: Crash reporting behind a port, Sentry behind it

- Status: accepted
- Date: 2026-09-05
- Refines: ADR-0002 §"Ops stack" (Sentry was decided; this fixes the shape)

## Context

ADR-0002 chose Sentry and the launch checklist requires crash reporting
live, verified with a deliberate test crash, before the first TestFlight
build. The audit-and-ship brief's build order ends with exactly that. The
owner gave the yes for the dependency on 2026-09-05. The same rules that
shaped analytics (ADR-0015) apply: nothing may block or gate the training
path, nothing identifying leaves the phone, and every ops SDK must be
absent from a build that lacks its key.

## Decision

1. **One port, two adapters** (`app/src/monitoring/monitoring.ts`):
   `init`, `captureError(error, context)`, and the two deliberate test
   failures. Sentry is selected only when `EXPO_PUBLIC_SENTRY_DSN` is
   set; otherwise the quiet adapter keeps the last few captures in
   memory for tests. Nothing else imports the SDK.
2. **Crash and error reports only.** Performance tracing, user
   interaction tracing, failed-request capture, screenshots and view
   hierarchy are all off; `sendDefaultPii` is false; `setUser` is never
   called; `beforeSend` strips `user` and `request` from every event.
   Breadcrumbs are capped at 30.
3. **Where it starts and what it hears.** The root layout calls `init`
   at module load, before the first render, so the global handlers
   catch anything the tree throws; native crashes reach the native SDK
   through the Expo config plugin. One handled site reports on purpose:
   a failed session save (`completeSession`), because it is the one
   error where her session is safe only if the retry works. Context
   labels are fixed strings, never her content.
4. **Never blocks, never surfaces.** Every port call is synchronous,
   fire-and-forget, and swallows its own failures; an SDK that fails to
   start cannot take the app with it. The SDK queues offline and sends
   later, so airplane mode costs nothing.
5. **Verification is in the app.** Settings → Developer tools (dev builds
   only) has "Throw a test error" and "Crash natively". Both go through
   the port; without a DSN they do nothing. The checklist item is done
   when the owner sees both events symbolicated in Sentry from a real
   build.
6. **Build-time symbolication.** `app/metro.config.js` wraps Expo's
   default config with Sentry's, so release bundles carry debug ids.
   Organisation, project and the upload token are supplied to EAS as
   `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` (the token as
   a secret), never in app config, never in the binary.

## Consequences

- One dependency, `@sentry/react-native`, with a native module: the
  owner rebuilds the dev client (`rm -rf app/ios && npx expo run:ios`).
- The Hermes bundle grows by about 1.9MB. Accepted: the alternative is
  learning about crashes from one-star reviews.
- App Store Connect's App Privacy answers add "Crash Data" and
  "Performance Data (diagnostics)", not linked to identity.
- Until the owner creates the project and sets the DSN, every build runs
  the quiet adapter and reports nothing anywhere.
