# ADR-0025: The free-sessions experiment (one vs three qualifying sessions)

- Status: accepted
- Date: 2026-09-07
- Extends: ADR-0009 §2–3, ADR-0014 §6 (the gate and the store trial)

## Context

Today the paywall never blocks the first session and gates every new
session after one completed session until the store entitles her
(ADR-0009 §2, ADR-0014 §6). Wave 5 of the growth brief
(docs/implementation-checklist.md) asks whether three free sessions
convert and retain better than one, measured properly rather than
guessed. The comparison has to run behind the existing entitlement
boundary, assign each install once and deterministically, work in
airplane mode like everything else on the training path, and change
nothing in production until the owner switches it on.

## Decision

1. **The experiment.** `free_sessions_v1`, two variants: `control`
   (one qualifying free session, today's policy) and `three` (three).
   The only thing a variant changes is the allowance the entitlement
   policy compares against. Defined once, in
   `app/src/monetization/experiment.ts`.

2. **What qualifies.** A qualifying session is a **committed** session
   whose engine result carried the `session` ledger event — the same
   fact that stamps the first completed date today. The engine emits
   that event only when at least one block completed, so: an abandoned
   session (never committed) does not count; an all-skipped session
   commits but does not count; a "Hard today" close counts if a block
   was attempted and the engine awarded the session. The count moves
   once per session id: the completion journal may replay one committed
   record after a crash, and the replay is a no-op for the count
   (`recordQualifyingSession(sessionId, date)` is idempotent per id).
   The count lives beside the trial stamp in the entitlement record,
   persisted and evaluated offline.

3. **The policy.** `beforeTrial` (nothing gates) holds while
   `qualifyingSessions < freeSessions` and no entitlement was ever held;
   `gated` after; `purchased` and `trialExpired` are unchanged. The
   first completed date is kept for the trial stamp and the paywall's
   letter. Migration: a pre-experiment record with the first completed
   date set and no count reads as one spent qualifying session; a
   consumed allowance is never reset; `purchase` and `trialUsed` are
   never touched by migration.

4. **Assignment.** Once per install, from a random seed drawn on the
   phone on the first assignment and persisted (`fither/experiments-v1`),
   never from analytics, the network or her identity. The variant is a
   pure function of (seed, experiment id), so it is stable across
   launches and offline; the recorded variant is what every later read
   returns. Assignment never happens before the store has hydrated.
   The record is in the shared persisted-store list, so "erase
   everything" and the dev first-run reset clear it with the rest.

5. **Activation is build configuration.**
   `EXPO_PUBLIC_EXPERIMENT_FREE_SESSIONS` is `off` by default: everyone
   is control and no assignment is recorded — the production default
   until the owner sets it to `on` explicitly, which assigns 50/50 and
   records. Switching it off later reads control for everyone again
   without erasing the record. A dev-only override in the store
   (`forceVariant`, read only under `__DEV__`) lets the Settings
   previewer show either side without touching activation or the
   record.

6. **Unchanged.** Prices, the paywall's letter and disclosures, the
   lifetime offer's rule (ADR-0014 §2), and Apple's introductory-offer
   eligibility: the free week is still the store's introductory offer,
   started from the paywall, and the app never claims or counts it. The
   variant changes how many sessions come before the paywall, nothing
   about what the paywall says or sells.

7. **What it evaluates.** Retained paying users and net revenue per
   eligible new user over a stated window (eligible: a fresh install
   assigned while the experiment is on; window: to be stated when it
   is switched on, no shorter than the trial plus one renewal). That
   reading needs RevenueCat and App Store data joined to the assignment,
   not client events alone — the client can say which variant an
   install had and whether the paywall was seen, never whether a renewal
   was paid. An `experiment_exposure` analytics event is reserved in
   ADR-0024 §3 and is added there when the measurement wave lands, not
   here.

## Consequences

- `entitlementStatus` takes `qualifyingSessions` and `freeSessions`; the
  launch surface, the route guard and the paywall pass the count from
  the entitlement store and the allowance from
  `freeSessionsAllowance()` / `useFreeSessionsAllowance()`.
- The session store calls `recordQualifyingSession(stableId, date)`
  after its commit, only for a result that carried the `session`
  event, in both the live completion and the stale-snapshot path. The
  completion journal's canonical write should carry the count (and
  `trialUsed`) so a crash between its write and the store's own leaves
  the disk whole.
- The experiment store belongs in the launch hydration set: an
  unhydrated store reads as control, which is right for a fresh
  install but would gate a `three` user with one session for the
  length of a slow hydration.
- No engine change, no new dependency, no new copy: the letters are
  the same letters, shown later for half of the installs while the
  experiment is on.
