# ADR-0027: One person across devices, and an event at every exit

- Status: accepted
- Date: 2026-09-08
- Extends: ADR-0015 (analytics port and PostHog), ADR-0024 (funnel events)

## Context

After the first device sessions the owner asked two things of the
numbers: where people drop off, step by step, and that a person be
counted once — across a reinstall, a second iPhone, and the store's own
purchase events. ADR-0015 ruled out `identify()` so that no provider id
reached the vendor; the funnel of ADR-0024 measured screens, not the
exits between them. Both rules were right for launch and too coarse for
the questions now asked.

## Decision

1. **Twenty exit events**, all in `app/src/analytics/events.ts`, each
   named for what the platform observed: `sign_in_view`,
   `sign_in_result`, `prompt_answer` (one per daily-prompt step),
   `no_session_shown`, `no_session_action`, `care_note`, `preview_leave`,
   `voice_ask`, `block_outcome` (one per block, with its index),
   `skill_unlocked`, `reminder_ask`, `paywall_plan`, `paywall_leave`,
   `purchase_result`, `restore_result`, `lifetime_offer`,
   `share_complete`, `account_action`. Every rule from ADR-0015 stands:
   closed unions or small numbers, never a note, never an area, never a
   name. `docs/measurement.md` defines the funnels built from them.
2. **Identity is a one-way hash.** On Sign in with Apple the app calls
   `identify()` with `sha256("fither-analytics-v1:" + appleUserId)`
   (`app/src/analytics/identity.ts`, pure TypeScript, no native module).
   The Apple id itself still never leaves the phone. Sign-out and erase
   `reset()` the person. Until she signs in, the person is the anonymous
   id the platform created on the phone, exactly as before.
3. **The store customer is the same person.** After the billing adapter
   configures RevenueCat it aliases the store's anonymous customer id to
   the analytics person; on sign-in it logs the customer in under the
   same hash; on sign-out it logs out. RevenueCat's PostHog integration
   (an owner step in the dashboard) then delivers purchase, renewal,
   cancellation and expiration as server events on that person. The app
   never sends a purchase event of its own beyond `purchase_result` and
   `trial_start`, which say what the sheet returned.
4. **Person properties, set whole**: `entitlement`, `sessions_completed`,
   `last_minutes`, `intention`, `voice`, `signed_in`, written by
   `app/src/analytics/person.ts` after each commit, purchase, restore,
   intention and voice answer, and on launch. PostHog's own application
   lifecycle events are on; nothing custom duplicates them.
5. **The privacy policy names every event** in plain words and the hash
   in one sentence (fither-web, `privacy/index.html`); the events list
   there and the schema here change together.

## Consequences

- The funnels answer "where did she leave" for the prompt, the
  session, the paywall and the asks, split by any person property.
- Paid conversion becomes visible per person without a backend
  (ADR-0022's Supabase stays a first-update decision, not a
  measurement prerequisite).
- A salted hash is a persistent identifier under the CCPA; the policy
  says so, and erase resets it. The salt keeps the value distinct from
  any other product hashing the same Apple id; it does not make the
  hash secret, and nothing here treats it as one.
- Anonymous events before sign-in are stitched to the person by the
  platform; a guest who never signs in is one person per phone, as
  before.
