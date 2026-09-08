# Measurement: cohorts, queries, and what cannot be known

Companion to ADR-0015 and ADR-0024. Every definition below is written
against the events in `app/src/analytics/events.ts` and nothing else.
PostHog is the only store; there is no server. Read "Limits" before
quoting any number.

## The trained-day definitions, and why there are two

| name | definition | used by |
|---|---|---|
| Trained day (UI) | a local date with at least one committed session in which a block was attempted (completed or struggled), ADR-0023 | Home week view, streak, weekly intention, recap |
| Fully completed workout (analytics) | a `workout_complete` with `close` in {completed, endedEarly, outOfTime} and at least one completed block; the event's `first` and `streak` come from the same commit | activation, retention below |

Activation deliberately uses the stricter definition so a week of
"Hard today" sessions counts for her on the phone and is still visible
as a separate cohort in the data.

## Cohorts

All windows are in the user's local time as the phone reported it at
event time (PostHog stores the device timestamp). "First use" is the
first `first_use_entry` per anonymous id.

| metric | numerator | denominator | window |
|---|---|---|---|
| First-workout completion | ids with a fully completed workout | ids with `first_use_entry` | 7 days from first use |
| Candidate activation | ids with fully completed workouts on two different local dates | ids with `first_use_entry` | 7 days from first use |
| Week-two training retention | ids with a fully completed workout in days 8 to 14 | ids with `first_use_entry` | days 8 to 14 |
| Week-four training retention | same in days 22 to 28 | ids with `first_use_entry` | days 22 to 28 |
| Onboarding completion | `onboarding_complete` | `first_use_entry` | same day |
| Preview to start | `workout_start` | `session_preview` | same session |
| Start to finish | `workout_complete` (any close) | `workout_start` | same session |
| Paywall exposure | ids with `paywall_view` (surface gate) | ids gated (qualifying sessions reached the allowance) | first 14 days |
| Trial start | `trial_start` | `paywall_view` | 24 hours |
| Share initiation (wave 3) | `share_start` | `share_eligible` | same screen |
| Recipient entry (wave 3) | `scenario_entry` | web page views by scenario (web analytics, same minimisation) | not attributable per person |

Per-variant and per-scenario cuts: group by `experiment_exposure.variant`
(wave 5) and by the first `scenario_entry.scenario` per id (wave 3).

## Drop-off funnels (2026-09-08)

The owner's question after the first device sessions: where do people
leave. The drop-off pass added the events below (all in
`app/src/analytics/events.ts`); each funnel is a PostHog funnel over one
person, ordered, with the window stated. Read the steps as facts the
platform observed, never as intent.

| funnel | steps, in order | window |
|---|---|---|
| Sign-in | `sign_in_view` → `sign_in_result` (split by `method`, `outcome`) | same screen |
| Daily prompt | `prompt_answer` step=time → energy → quiet → soreness → `session_preview` | 30 minutes. `quiet` is absent when a place preset answered it: build the funnel with quiet optional |
| Dead end | `no_session_shown` → `no_session_action` (split by `action`) → `session_preview` | 30 minutes; `areas` and `unblocking` say how far from a session she was |
| Preview to start | `session_preview` → `workout_start`; `preview_leave` counts the ones who went back | same session |
| Inside the session | `workout_start` → `block_outcome` per `index` → `workout_complete`; the first `index` whose `outcome` is skipped, or the last `index` seen before an `endedEarly` close, is where the session broke | same session |
| First close to the asks | `workout_complete` first=true → `reminder_ask` → `weekly_intention_set` | same day |
| Voice | `voice_ask` (split by `voice`) against later `workout_complete` counts | 14 days |
| Paywall | `paywall_view` → `paywall_plan` → `purchase_result` (split by `plan`, `outcome`); `trial_start` remains the trial's own event; `paywall_leave` where the surface allows leaving | 24 hours |
| Lifetime offer | `lifetime_offer` view → `purchase_result` plan=lifetime, or `lifetime_offer` decline | same screen |
| Restore | `restore_result` split by `outcome` | none; a failure rate, not a funnel |
| Share | `share_eligible` → `share_start` → `share_complete` (split by `completed`) | same screen |
| Churn signals | `account_action` split by `action`; pair with the person's `sessions_completed` at the time | none |

Return visits come from PostHog's own `Application Opened` (with
`from_background`) and `Application Backgrounded`, turned on in the
adapter; no custom event duplicates them.

**Identity.** Until she signs in, the person is the anonymous id PostHog
created on the phone. On Sign in with Apple the app calls `identify`
with a one-way salted hash of the Apple user id
(`app/src/analytics/identity.ts`), so a reinstall or a second iPhone
counts as the same person and the funnels above survive a device change.
The Apple id itself never leaves the phone; sign-out and erase reset the
person. Person properties (`entitlement`, `sessions_completed`,
`last_minutes`, `intention`, `voice`, `signed_in`) are set whole after
each commit and each purchase, so any funnel can be split by them.

**Paid conversion** is not an app event: RevenueCat's PostHog integration
sends purchase, renewal, cancellation and expiration as server events
against the same person (RevenueCat app user id = the PostHog distinct
id; the adapter passes it through). Turn it on in RevenueCat →
Integrations → PostHog with the project key.

## Queries (PostHog, HogQL sketches)

First-workout completion per first-use entrant:

```
SELECT count(DISTINCT c.distinct_id) / count(DISTINCT f.distinct_id)
FROM events f
LEFT JOIN events c ON c.distinct_id = f.distinct_id
  AND c.event = 'workout_complete'
  AND c.properties.close != 'nothingDone'
  AND c.timestamp BETWEEN f.timestamp AND f.timestamp + INTERVAL 7 DAY
WHERE f.event = 'first_use_entry'
```

Candidate activation (two different local dates within seven days):

```
SELECT count() FILTER (WHERE days >= 2) / count()
FROM (
  SELECT f.distinct_id,
         count(DISTINCT toDate(c.timestamp)) AS days
  FROM events f
  LEFT JOIN events c ON c.distinct_id = f.distinct_id
    AND c.event = 'workout_complete' AND c.properties.close != 'nothingDone'
    AND c.timestamp BETWEEN f.timestamp AND f.timestamp + INTERVAL 7 DAY
  WHERE f.event = 'first_use_entry'
  GROUP BY f.distinct_id
)
```

Week-two retention swaps the interval for `+8 DAY` to `+14 DAY`; week
four for `+22 DAY` to `+28 DAY`.

## Limits, stated

- **Anonymous ids reset** on sign-out and on the dev first-run reset; a
  reinstall is a new id. Every cohort therefore undercounts returning
  users and overcounts "new". There is no person-level attribution and
  none is claimed.
- **Offline delivery**: events queue on the phone and arrive late, with
  their original device timestamps. Windows close 3 days after their end
  before a number is read.
- **A share sheet opened is not a share sent**; iOS reports nothing
  after `share_start`. Recipient numbers come from the web page and
  cannot be joined to the sender.
- **Revenue facts** (paid conversion after trial, renewals, refunds, net
  revenue per eligible new user) exist only in RevenueCat and App Store
  Connect. Client events see `trial_start` and, from wave 5,
  `purchase_outcome`; they never see a renewal. The experiment's primary
  metric (retained paying users and net revenue per eligible new user
  over 60 days from first use) is read from RevenueCat's charts cut by
  the `variant` attribute the app sets on the customer, not from PostHog.
- **Web analytics** on the recipient page use the same minimisation: no
  cookies across sites, no fingerprinting, path and scenario only.
