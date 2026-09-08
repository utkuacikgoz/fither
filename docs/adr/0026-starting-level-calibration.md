# ADR-0026: Starting-level calibration, and G2 re-scoped to earned tiers

- Status: accepted
- Date: 2026-09-08 (decision 3 and gate 2 narrowed by the owner the same
  day — see "Narrowing" below)
- Amends: ADR-0003 (regression), engine-spec.md gate 2

## Context

Every profile starts at tier 1 on all five patterns. For the woman who
already trains — she runs, she did yoga for years, she can do ten
push-ups — the first fortnight is wall push-ups and supported
sit-to-stands. The time floor (ADR-0008) is deliberate pacing for
someone starting from scratch, but for her it is the app failing to
notice who it is talking to. Onboarding cannot ask her to self-rate:
"what level are you?" is exactly the intimidating, judgement-shaped
question this product refuses to ask, and self-reports are unreliable in
both directions.

The alternative is to let the first sessions ask with movement instead
of words. The taste mechanism already exists (ADR-0007): one set of the
next tier, appended for a strong-energy session, progression- and
points-neutral. Widening its mouth for the first two sessions turns it
into a placement question the user answers with her body.

Four questions went to the coach and the owner; all four were answered
on 2026-09-08.

1. **Is a one-set taste of the next tier safe on every ladder, for
   someone we know nothing about?** Yes — safe on all five. One set of
   tier 2 or tier 3 is within reach of anyone the tier below is within
   reach of, and the movements at those tiers are supported or partial
   variants throughout.
2. **How much evidence is enough — one clean set, or a whole session?**
   One clean set is enough. She is not being promoted; she is being
   placed. Asking for more would spend the fortnight the calibration
   exists to save.
3. **How high may calibration place her?** Cap at tier 3 — not 4, even
   on push and squat where the ladders are longest and the tier-4 step
   (full push-up, split squat) is the milestone. Above tier 3 she earns
   it the ordinary way.
4. **Which session lengths offer it?** All of them, ten minutes
   included. Ten minutes is complete; a woman whose only slot is ten
   minutes must not be the one who never gets asked. The budget still
   rules: a taste is offered only when the block-plus-taste pair fits,
   so a short session offers as many as fit and simply does not offer
   the rest.

## Decision

**1. Calibration.** While a profile has fewer than
`CALIBRATION_MAX_SESSIONS` = 2 sessions in history, every pattern that
gets a block is offered ONE set of the next tier directly after that
block, at any energy. Completing it cleanly raises where that pattern
STARTS next session by exactly one tier, capped at
`CALIBRATION_MAX_TIER` = 3. Struggled or skipped changes nothing. The
taste itself stays progression- and points-neutral like every other
taste: no clean-session credit, no ledger event, never `atNewTier`.
Two sessions means tier 1 → 2 → 3 at most, and never again.

The session announces each one as a distinct `calibrationTaste`
adaptation (pattern + movementId), separate from the strong-energy
`tasteBlock`, because the two look identical on screen and mean
different things: one is a bonus, the other is the question "is this
where you should start?". A pattern eligible for a calibration taste is
never also given a plain one.

**2. Placement is not earning.** `PatternState.earnedTier` records the
highest tier the ORDINARY progression put the pattern at — the
clean-count rule of ADR-0002 with the time floor of ADR-0008. It is
stamped on every ordinary advance and never by a calibration placement.
It is optional on read and defaults to the pattern's current tier, so a
profile persisted before the field existed counts as having earned where
it stands: no migration ever hands an existing user a deeper fall than
the ordinary one-tier drop. `earnedTierOf(state)` and
`regressionFloor(state)` are exported so the UI reads that default, and
how far the floor is, from the engine rather than re-deriving either.

**3. Regression floors one tier below the earned tier.** ADR-0003's
third consecutive struggled session still drops one tier, but never
below `regressionFloor(state)` = `max(1, earnedTier - 1)`. An earned
tier is a bottom, not a ratchet: repeated struggle may still take her
the one ordinary tier under it, exactly as ADR-0003 always allowed. What
`earnedTier` changes is only that a calibration PLACEMENT can be
corrected — one tier per three struggled sessions, all the way back to
the earned mark — without that counting as a regression in gate 2. Once
she is on the floor she stays there, volume-reduced: the soft landing is
the whole response.

(This paragraph is the owner's narrowing of 2026-09-08; the first
version of this ADR floored the drop at `earnedTier` itself. See
"Narrowing" below.)

**4. Gate 2 is re-scoped** (owner decision 2026-09-08, option 1, as
narrowed the same day) from "a 2×/week user never regresses a tier" to
"a 2×/week user never falls more than one tier below a tier she EARNED".
Two kinds of drop are explainable and are therefore not regressions for
the gate: a calibration placement being corrected (unearned ground,
unwound — the app finishing the sentence the first two sessions
started), and the one ordinary struggle-driven drop off an earned tier
that ADR-0003 always allowed. `pnpm sim` prints all three numbers:
drops more than one tier below earned (the gate, must be 0), ordinary
struggle-driven drops from an earned tier (information), and calibration
placement corrections (information).

Honesty about what the gate now measures: the floor is enforced inside
`applySessionResult`, so the gate can only fail if the engine breaks its
own rule. It is an end-to-end invariant assertion over 39,051 sessions,
not a behavioural discovery the sim could make on its own. That is the
honest alternative the owner asked for in preference to inventing a
metric; the signal lives in the two informational counts beside it.

## Consequences

Easier: the woman who already trains is placed in two sessions instead
of waiting out a floor built for someone else. In the sim her push tier
4 arrives at median week 5 against week 7 for the from-scratch 4×/week
persona, without moving G1's floor or G5's ceiling.

Harder / narrower: a pattern that climbed the ladder the normal way can
still lose one tier to repeated struggle — the ordinary ADR-0003
response, unchanged — and the fall stops there. Milestone tiers (4 and
6) sit above the calibration cap, so a milestone can only ever be
dropped out of by that ordinary one-tier drop; the unlock itself is
remembered for life in `unlockedMilestones` and is never re-awarded on
the way back up. Two tiers below earned is unreachable, which is what
makes the returning-after-illness case safe without making the ladder a
ratchet.

Two judgment calls beyond the four answers, flagged for confirmation:
a pattern she STRUGGLED at her current tier in the same session is not
started higher whatever its taste said (it can only ever prevent an
unearned jump, never cause one); and calibration raises at most one tier
per session, so a pattern the ordinary rules already moved that day is
left alone.

Forbidden by this decision: asking her to self-rate her level, and any
copy that frames a placement correction as losing something.

## Narrowing (owner, 2026-09-08)

The first version of this ADR read "earned must never be lost" straight
and floored the drop at `earnedTier`, making the ladder a permanent
ratchet. The owner narrowed it the same day: a normally-earned tier must
NOT be a ratchet. Repeated struggle may still drop her one tier, exactly
as ADR-0003/ADR-0008 always allowed. What `earnedTier` changes is only
that a calibration PLACEMENT can be corrected without that counting as a
regression in gate 2. Decisions 3 and 4 above are written as narrowed;
`regressionFloor` in `packages/engine/src/apply.ts` is the one place the
rule lives.

## Sim (seed 20260831, 500 users, 26 weeks, 39051 sessions)

```
Personas: consistent4=72, consistent2=72, lowCapability2=72, erratic=71, quiet=71, tenMin=71, experienced=71
G1 PASS  4x/week push tier >= 4 by week 12: 72/72 users (100.0%), median week 7; experienced (info): 71/71 by week 12, median week 5
G2 PASS  2x/week drops more than one tier below earned: 0; ordinary struggle-driven drops from an earned tier (info): 0; calibration placement corrections (info): 15; low-capability difficult blocks: 1290/25009
G3 PASS  sessions over time budget: 0 of 39051, max utilization 100.0%, min 90.0%
G4 PASS  max pattern absence: 3 training days (limit 7)
G5 PASS  median full-ladder exhaustion week (consistent personas must be >= 18 or never): consistent4=22, consistent2=22, lowCapability2=22, quiet=22, tenMin=23, experienced=21; erratic=25 (info only)
```

The narrowing moved no number in this run: the 2×/week personas take no
ordinary struggle-driven drop at all here (0), so their only 15 drops
are the calibration placement corrections. The wider floor is headroom
for the struggling user, not a change to the modelled ones.

Before the re-scope the same run printed `G2 FAIL  2x/week tier
regressions: 15` — the 15 are exactly the calibration placement
corrections above, and no 2×/week user in the run ever lost a tier she
earned.
