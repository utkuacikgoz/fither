# PostHog: wiring (ADR-0015)

The app talks to analytics through one port (`app/src/analytics/
analytics.ts`). The PostHog adapter is selected the moment its public
project key is present; without it every build and every test uses the
in-memory dev adapter and nothing leaves the phone. The dependency is
pure JavaScript — no rebuild is needed to switch it on.

## Owner steps

1. Create a PostHog project (US or EU cloud). Copy the **project API
   key** (`phc_…`) from Project settings. It is a public client key.
2. Local dev: add to `app/.env` (gitignored):

   ```
   EXPO_PUBLIC_POSTHOG_KEY=phc_…
   # Only if the project is in the EU:
   # EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
   ```

3. EAS builds:

   ```
   eas env:create --scope project --name EXPO_PUBLIC_POSTHOG_KEY --value phc_… --environment production
   ```

   Expo inlines `EXPO_PUBLIC_*` at bundle time; a build without the
   variable ships the dev adapter.
4. In PostHog, switch **off** what the app already refuses: autocapture,
   session replay, surveys, GeoIP enrichment (Project settings → the
   "Discard client IP data" toggle). The SDK sends `disableGeoip`, but the
   project setting is the belt to that brace.
5. App Store Connect → App Privacy, once the key ships: Product
   Interaction and Device ID, both "not linked to the user's identity"
   and "not used for tracking".

## What arrives

| Event | Properties | Fires |
|---|---|---|
| `deep_link_open` | `path` | launch URL and each new URL, once; path only |
| `workout_start` | `minutes` (10/20/30) | the player's first real transition |
| `workout_complete` | `minutes`, `close` (completed / endedEarly / outOfTime / nothingDone), `first` | after the result commits, once |
| `trial_start` | `plan` (annual / monthly) | the store granted a subscription trial |

No `identify()` is ever called; the distinct id is PostHog's anonymous
one, reset on sign-out. Nothing else is sent: no screen views, no
lifecycle events, no device model, no locale.

## Verifying

Run the app with the key set, complete a session, and watch Activity in
PostHog: `workout_start` then `workout_complete` with `first: true`. In
airplane mode the events queue in AsyncStorage and arrive on the next
flush after the network returns.
