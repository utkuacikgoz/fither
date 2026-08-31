# ADR-0003: Regression policy, daily prompt, point values

- Status: accepted
- Date: 2026-08-31

## Context

Second decision round with the owner (after ADR-0002), resolving the
remaining engine and gamification unknowns before the movement-author and
engine-engineer sessions start.

## Decision

1. **Regression: volume first, tier after 3.** Two consecutive struggled
   sessions on a pattern reduce volume at the same tier; a third drops
   one tier. Any clean session resets the counter. Absence never
   regresses (unchanged hard gate).
2. **Daily prompt: four questions** — time (10/20/30), energy
   (low/okay/strong), quiet (yes/no), soreness (one-tap "All good"
   default with optional body-area picks). ~10–15 seconds total; no
   additions without revisiting Gate 3.
3. **Points: 1 per minute plus bonuses.** 10/20/30 per completed session
   by length, +5 per block completed at a newly-reached tier, +25 per
   skill unlock. Values live in a single tunable table in the engine.

## Consequences

engine-spec.md, fither-domain SKILL.md and gamification.md updated; their
DECIDE/PROPOSED markers removed. Remaining open: state library (zustand,
PROPOSED in fither-code) — resolve at Brief 0 scaffold; Briefs 1–8 still
override nothing here without a new ADR.
