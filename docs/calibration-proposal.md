# Starting-level calibration: a bounded proposal for coach review

Status: proposal, not enabled. Nothing here changes the engine or the
movement library until the coach review (docs/coach-review.md) answers
the questions at the end.

## The problem

Every profile starts at tier 1 on all five ladders (ADR-0008). A woman
who already does full push-ups spends her first sessions on wall
push-ups, earns the same clean counts as a beginner, and reaches her
real level in weeks. The sim shows a 4x/week user reaching push tier 4
at median week 8; for her that is eight weeks of undertraining, and the
first session, the one that decides whether she comes back, feels like
a toy.

## The constraint

No quiz, no self-rating, no "how fit are you" screen (fither-domain: four
answers and nothing else before the first session). Whatever calibrates
her level must happen inside the first workout, from what she does.

## Proposal: one taste per pattern in session one

The engine already has the taste block (strong energy: one set of the
next tier, progression-neutral, ADR-0007). The proposal reuses it:

1. **Session one only, any energy**: after each pattern's first block,
   the player offers one set of the tier-two movement as a taste
   ("Try the next one?"), skippable in one tap. Five tastes at most,
   one set each, inside the same budget (the engine already reserves
   60 s for a taste; five would reserve up to 5 x ~45 s = about 4
   minutes of a 20-minute session, or the tastes are limited to two
   patterns on a 10-minute session).
2. **Her answer calibrates**: a taste marked "Strong" (completed without
   struggle) starts the pattern at tier 2 instead of 1 from session two;
   a taste marked "Hard today" or skipped leaves it at tier 1. Never
   higher than tier 2 from one session: the second session may offer the
   tier-three taste on the patterns that moved, and so on, one tier per
   session, capped at tier 3 by calibration. Above that the ordinary
   clean-count rule applies.
3. **Nothing is claimed**: the receipt shows what she did; the preview
   the next day says "Push starts at tier 2" as a fact line. No badge,
   no "you are advanced".

## What it costs and what it must not do

- Engine change: a `calibrationTaste` adaptation and a `startTier` write
  in `applyResult` for session one and two. Sim gates re-run; G1 and G5
  must hold for the beginner personas (they never take a taste as
  Strong, so nothing changes for them) and a new persona
  ("experienced2", tastes Strong on push and squat) should reach tier 4
  push by week 6 or so.
- Movement library: none.
- Safety: the taste is one set of the very next rung, the same step the
  ladder takes anyway; the coach review decides whether any tier-two
  movement is a bad first exposure (candidates: incline push-up on a
  chair for someone who has never held a plank).

## Questions for the coach

1. Is one set of the tier-two movement a safe first taste on every
   ladder, or should some ladders (hinge? core?) calibrate one session
   later?
2. Is "Strong" on one set enough evidence to start at tier 2, or should
   it need two sessions?
3. Cap at tier 3 by calibration, or allow tier 4 for push and squat?
4. Should the taste be offered on a 10-minute session at all?
