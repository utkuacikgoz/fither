# Sentry: wiring (ADR-0016)

The app reports through one port (`app/src/monitoring/monitoring.ts`).
The Sentry adapter is selected the moment its DSN is present; without it
every build and every test uses the quiet adapter and nothing leaves the
phone. The SDK has a native module, so switching it on needs a rebuild.

## Owner steps

1. Create a Sentry project of type **React Native** (organisation slug
   and project slug are shown in the project's settings URL). Copy the
   **DSN** from Project settings → Client Keys. It is a public key.
2. Local dev: add to `app/.env` (gitignored):

   ```
   EXPO_PUBLIC_SENTRY_DSN=https://…@….ingest.sentry.io/…
   ```

   Then rebuild: `git pull && rm -rf app/ios && cd app && npx expo run:ios`.
3. EAS builds, all three environments:

   ```
   eas env:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value https://… --environment production
   eas env:create --scope project --name SENTRY_ORG --value <org-slug> --environment production
   eas env:create --scope project --name SENTRY_PROJECT --value <project-slug> --environment production
   eas env:create --scope project --name SENTRY_AUTH_TOKEN --value sntrys_… --environment production --visibility secret
   ```

   The auth token (Sentry → Settings → Auth Tokens, scopes
   `project:releases` and `org:read`) lets the build upload source maps
   and dSYMs. It is used only at build time and never enters the binary.
   Repeat for `preview` and `development` if you want those builds
   symbolicated too.
4. In Sentry → Alerts, create one alert rule: "a new issue is created" →
   notify you by email and the Sentry mobile app. That is the "alerts
   reach the owner's phone" line of the launch checklist.
5. App Store Connect → App Privacy, once the DSN ships: Crash Data and
   Performance Data (diagnostics), not linked, not used for tracking.

## Verifying (the launch-checklist item)

In a dev build with the DSN set: Settings → Developer tools → "Throw a
test error", then "Crash natively" (the app will close). Reopen it once;
both events appear in Sentry within a minute, the JS one with readable
file names and line numbers. If frames show as minified, the source-map
upload step failed: check the three `SENTRY_*` variables on the build.

## What is sent

Uncaught JS errors, native crashes, and one handled report: a failed
session save, tagged `context: completeSession`. Each carries the app
version, OS version, device model, Sentry's anonymous installation id,
and the last 30 breadcrumbs (navigation, console). No user id, no name,
no email, no request data: `beforeSend` strips `user` and `request`
from every event, and `setUser` is never called.
