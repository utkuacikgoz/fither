# ADR-0021: The minutes she asked for, and a fresh movement before a repeat

- Status: accepted
- Date: 2026-09-07
- Refines: ADR-0003 (the daily prompt), ADR-0008 (progression and time floors)

## Context

The coverage audit (`packages/engine/sim/coverage.ts`,
`docs/engine-decision-tree.md`) walked all 331,776 daily prompts the app
can send and found two things the sim's realistic personas never hit:
with two or more avoided areas leaving one or two patterns, the
per-pattern block cap of 4 left a 30-minute session at 40 to 75% of its
budget; and the movement picker repeated a movement before it would try
an unused one a tier down, so nearly every long session with one area
avoided contained a repeat. The owner decided both on 2026-09-07.

## Decision

1. **Fill the minutes.** `maxBlocksPerPattern` grows as patterns fall
   away: 5 patterns -> 2 blocks each, 4 -> 3, 3 -> 4, 2 -> 6, 1 -> 12. A
   session she asked 30 minutes for is 30 minutes, even when only core
   survives her avoid list.
2. **Fresh before repeat.** `pickMovement` takes an unused movement at
   the profile's tier, then one tier down, and so on to tier 1, before
   it repeats anything; a repeat comes from the highest tier that has an
   eligible movement, and only when the pattern's whole eligible pool is
   already in the session.

## Consequences

- Whole space: every non-empty session now fills to the 90% target;
  sessions containing a repeat fell from 205,892 to 118,272, all of them
  pool-exhausted. Sim gates unchanged (G1 84/84 median week 8; G2 0
  regressions, 758/28319 difficult blocks; G3 0 over budget; G4 max
  absence 3; G5 medians 22 to 23).
- A one-pattern 30-minute session is twelve blocks of that pattern at
  tiers she has reached. That is the honest answer to "30 minutes, and
  nothing that loads shoulders or hips"; the no-session outcome's
  set-aside rows remain the way to a rounder day.
- Easier movements now appear in long sessions as filler below her tier.
  They are prescribed at or below tier by construction and never affect
  progression upward (ADR-0008); the sim confirms the ladders still take
  the same weeks.
