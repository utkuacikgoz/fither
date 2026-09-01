# Gate 3 protocol — five women, sixty seconds

Gate 3 (docs/build-system.md §7): five women, on their own or a freshly
reset phone, with no help from you, each reach their first movement in
under 60 seconds of opening the app. If any of them doesn't, cut
onboarding questions until they do — that is the pre-agreed remedy, not
redesign.

The app now measures the number itself: time-to-first-movement is
recorded on device from app open to the first WORK phase — the moment
she is actually moving, not when the player appears. The dev readout
opens by long-pressing the day label on the daily prompt (dev builds
only). Use it as the number of record; keep a phone stopwatch as backup.

What the number covers: store loading, onboarding, the four questions,
session generation, the preview, and the first block intro. It starts
at the app's first screen mount — native launch time before that is not
included — so the recorded number slightly understates true icon-tap-to-
movement time. A sub-60s reading is therefore conservative in the right
direction; the stopwatch from icon tap is the stricter check.

## Who

Five women from the actual audience: busy, time-poor, not fitness-hobbyists,
ideally not close friends who have heard you describe the app (they know
too much). A colleague's partner, a neighbour, someone from the school
run. No developers.

## Setup, per tester

1. Fresh state: a clean install on the test phone, or the dev reset
   (recordings + entitlement + onboarding) so the app behaves as a first
   run. Verify the app opens to the welcome screen before handing it over.
2. Do Not Disturb on the phone; nothing else running.
3. Say only this, verbatim: **"This is a workout app. Use it however
   feels natural."** Then hand over the phone and say nothing else.

## During — watch, never help

- Do not answer questions. If she asks, say "whatever you'd do if I
  weren't here." Every answer you give invalidates her run.
- Watch WHERE she hesitates, not just how long: which screen, which
  wording, whether she re-reads, whether a tap target is missed. Write
  it down with the screen name. Her hesitations are the finding; her
  opinions are not — do not ask "what do you think?"
- The run ends when she is physically doing the first movement (not
  when the player appears — when she moves).

## Record, per tester

| Field | |
|---|---|
| Time to first movement (dev readout / stopwatch) | ___ s |
| Hesitation points (screen + what happened) | |
| Words she said aloud, verbatim | |
| Did she actually start moving without prompting? | yes / no |
| Anything she tried to tap that isn't tappable | |

## Pass / fail

- **Pass**: all five under 60 seconds, and all five actually began the
  movement unprompted.
- **Fail**: any tester over 60s or stalled → identify the costliest
  screen from the hesitation notes, cut or collapse it (ADR the change),
  re-run with two fresh testers. Repeat until pass.
- Either way, keep the notes: hesitations that didn't break 60s are the
  polish list for Phase 3.

## Afterwards

- Note each tester's numbers in this file's log below (initials only —
  no personal data in the repo).
- If she wants to keep using the app, let her — that's your first
  TestFlight cohort forming by itself.

## Log

| Date | Tester | Time (s) | Result | Notes |
|---|---|---|---|---|
| | | | | |
