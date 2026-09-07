# ADR-0018: A day streak, with one rest day forgiven

- Status: accepted
- Date: 2026-09-06
- Amends: the forbidden list in `fither-domain` (streaks were banned),
  ADR-0012 §"counters" (the word "streak" is no longer banned from the
  codebase)

## Context

The forbidden list banned streaks outright, on the grounds that a streak
is a chain that breaks and a broken chain is punishment. The owner
overruled that on 2026-09-06: a plain count of consecutive days is the
one gamification most women in the audience already understand, and the
harm is in the framing, not the count. The decision was taken with four
answers fixed at the same time: consecutive calendar days; one grace miss
per run; shown on the hub hero, the finish screen, the Progress tab and
the daily notification; the count sent to analytics on workout
completion. The rest of the forbidden list (weight, calories, body-shape
language) stands.

## Decision

1. **The rule lives in the engine** (`packages/engine/src/streak.ts`,
   `computeStreak(entries, todayIso)`). A day is trained when at least
   one block completed on it, the same fact the "session" ledger event
   records. A run is consecutive trained days. One missed day per run is
   a rest day: it adds nothing to the count and the run continues. A
   second miss ends the run. Today is never a miss until it is over: a
   run that is alive but untrained today is `atRisk`, never broken. The
   function is pure, takes no clock, and returns `current`, `best`,
   `graceUsed` and `atRisk`. No screen re-derives any of this.
2. **Four surfaces, one register.** The hub shows a dot, the count and
   one caption: what today does for the run when untrained, the best
   run when trained and there is a longer one. The finish screen shows
   "Day N in a row" (day 1 reads as a start, not a run of one). Progress
   shows the count, the best, and "Rest day taken" once the grace is
   spent. The daily invitation names the run in its body. Nothing shows
   a zero: with no run alive the hub shows nothing and Progress says how
   one begins.
3. **Never threatened.** No "don't break it", no "you'll lose", no
   reset copy, no miss-you notification, no red. A missed day is a rest
   day in every string. The copy rules are in `fither-voice` and the
   strings under `strings.streak`.
4. **The way out stays open.** The engine's helper is asked for which
   single area, set aside for today, would let a session build
   (`unblockingAreas`), so a day she wants to keep is never lost to an
   avoid list she can change for today only.
5. **Analytics.** `workout_complete` carries `streak: number`, the count
   after the session commits. Nothing else about the run leaves the
   phone.
6. **Data.** Nothing new is persisted: the streak is a fold over the
   history the engine already writes, so an erase, a reinstall or a
   restore gives the same answer from the same entries.

## Consequences

- Skipping every block is not training and starts nothing; a struggled
  block completed still counts, because it completed.
- The grace rule means a Monday/Wednesday/Friday trainer never holds a
  run past the weekend: Saturday is the rest day, Sunday ends it. That
  is intended. The streak is a daily habit's count, not a training
  frequency metric; Progress carries the frequency picture.
- The shape-guard test that banned the word "streak" in the engine's
  pattern state is narrowed to the pattern counters, which remain
  `cleanCount` and `struggleCount`.
- Engine tests 111 (26 for the streak); simulation gates unchanged, since
  the streak reads history and writes nothing.
