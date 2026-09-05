# ADR-0015: The analytics port, PostHog, and the four events

- Status: accepted
- Date: 2026-09-05
- Refines: ADR-0002 §"Ops stack" (PostHog was decided; this fixes the shape)

## Context

ADR-0002 chose PostHog and asked for "few and deliberate" events. The
audit-and-ship brief narrowed that to four — deep_link_open,
workout_start, workout_complete, trial_start — the ones that answer
"did she arrive, start, finish, and try". The brief also rules that no
dependency lands without the owner's yes; the owner gave it on
2026-09-05. Two hard rules shape the design: the app must work in
airplane mode, and the forbidden list applies to analytics and data
models, not just copy.

## Decision

1. **One port, two adapters** (`app/src/analytics/analytics.ts`), the
   same shape as billing, auth and notifications. Call sites use
   `track(name, properties)`; nothing else in the app imports the SDK.
   The PostHog adapter is selected only when `EXPO_PUBLIC_POSTHOG_KEY`
   is set (`docs/posthog-setup.md`); otherwise the dev adapter records
   the last 50 events in memory, which is what tests assert on.
2. **The event vocabulary is closed** (`app/src/analytics/events.ts`):
   the four names, each with a typed payload of closed unions and small
   numbers. Anything else is a compile error. A test scans the analytics
   directory, comments included, for the forbidden list's words.
3. **Where each fires, and exactly once:**
   - `deep_link_open { path }` — the root layout, for the launch URL and
     every URL that arrives while open; each distinct URL once. The path
     only: query and fragment are dropped unread (that is where tokens
     live). The dev client's own launch URLs are ignored.
   - `workout_start { minutes }` — the session store, on the player's
     first real transition (the same boundary the crash snapshot is born
     on). A restored session has already begun, so a relaunch never
     counts twice.
   - `workout_complete { minutes, close, first }` — the session store,
     after a freshly journaled result commits. A crash-replay of the
     same record sends nothing. `first` is true for her first ever
     completed session (the paywall stamp moment).
   - `trial_start { plan }` — the entitlement store, when the purchase
     sheet grants a subscription with a store trial (ADR-0014 §6).
     Lifetime, straight purchases and restores send nothing.
4. **Never blocks, never surfaces.** `track` is synchronous and
   fire-and-forget; both it and the adapters swallow every failure. The
   SDK queues to AsyncStorage and flushes when it can, so airplane mode
   costs nothing and loses nothing. Everything PostHog can do beyond
   capture is off: autocapture, lifecycle events, feature flags, remote
   config, surveys, session replay, geolocation.
5. **Anonymous only.** `identify()` is never called. The Apple provider
   id, name and email never reach the vendor. Sign-out and the dev
   first-run reset call `reset()`, so the next person on the phone is a
   new anonymous id.
6. **One dependency**, `posthog-react-native`, pure JavaScript: no
   native module, no rebuild, no pod. Its optional peers (expo-device,
   expo-application, expo-localization) are deliberately not installed —
   fewer device properties is the point. Storage falls back to the
   AsyncStorage the app already has.

## Consequences

- Adding an event means editing `events.ts` and this ADR's list; a
  fifth event that is not on the retention thesis is scope creep.
- App Store Connect's App Privacy answers change once a key ships:
  "Product Interaction" and an anonymous "Device ID", not linked to
  identity, not used for tracking. Recorded in the launch checklist.
- Until the owner creates the project and sets the key, every build
  runs the dev adapter and sends nothing anywhere.
- The events are recorded in the dev adapter in every dev build; the
  Settings developer tools do not display them (not in the brief).
