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
| `first_use_entry` | none | a fresh install reached its first decision screen (ADR-0024) |
| `onboarding_complete` | `equipment` (floor / chair) | onboarding handed off to the daily prompt |
| `session_preview` | `minutes`, `blocks` | a built session was shown on the preview |
| `workout_start` | `minutes` (10/20/30) | the player's first real transition |
| `workout_complete` | `minutes`, `close` (completed / endedEarly / outOfTime / nothingDone), `first` | after the result commits, once |
| `weekly_intention_set` | `target` (two / three / none) | she set or changed her weekly intention |
| `share_eligible` | `source` (finish / receipt / recap) | a share was offered on that surface |
| `share_start` | `source`, `context` (home / hotel / meetings / none) | she opened the share sheet; nothing after this is observable |
| `paywall_view` | `surface` (gate / expired / settings) | the paywall was on screen, once per showing |
| `scenario_entry` | `scenario` (allowlisted id) | the app opened from a shared /s/<id> link |
| `experiment_exposure` | `experiment`, `variant` (control / three) | a variant was assigned on this phone, once per experiment (ADR-0025) |
| `trial_start` | `plan` (annual / monthly) | the store granted a subscription trial |

The drop-off pass (2026-09-08) added twenty more, one per place she can
leave — `sign_in_view`, `sign_in_result`, `prompt_answer`,
`no_session_shown`, `no_session_action`, `care_note`, `preview_leave`,
`voice_ask`, `block_outcome`, `skill_unlocked`, `reminder_ask`,
`paywall_plan`, `paywall_leave`, `purchase_result`, `restore_result`,
`lifetime_offer`, `share_complete`, `account_action` — with the payloads
in `app/src/analytics/events.ts` and the funnels in
`docs/measurement.md`. PostHog's own `Application Opened` /
`Application Backgrounded` are on.

Identity: anonymous until Sign in with Apple, then `identify()` with a
salted one-way hash of the Apple user id; reset on sign-out and erase.
Person properties: `entitlement`, `sessions_completed`, `last_minutes`,
`intention`, `voice`, `signed_in`. Still never sent: screen views,
device model, locale, names, emails, the areas she works around, notes.

Owner step for paid conversion: RevenueCat → Integrations → PostHog,
paste the project key. Purchases, renewals, cancellations and expirations
then arrive as server events on the same person.

## Verifying

Run the app with the key set, complete a session, and watch Activity in
PostHog: `workout_start` then `workout_complete` with `first: true`. In
airplane mode the events queue in AsyncStorage and arrive on the next
flush after the network returns.
