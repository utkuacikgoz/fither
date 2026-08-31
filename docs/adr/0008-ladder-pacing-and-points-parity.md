# ADR-0008: Ladder pacing time floors; session points parity

- Status: accepted
- Date: 2026-09-01

## Context

The simulation deep-dive (docs/sim-analysis.md) showed two structural
problems the pass/fail gates could not see:

1. Every persona reaches tier 6 in all five patterns by week 8–12 —
   3 clean sessions per tier × sessions that cover all patterns means
   ~15 sessions to exhaust a ladder, leaving 14+ of 26 weeks with
   nothing to progress toward. Physically it also overstates how fast a
   deconditioned beginner adapts.
2. Points price duration: a 10-minute-only user at perfect consistency
   earns half a 30-minute user's points (1410 vs 3125 at week 26),
   contradicting "ten minutes is complete".

The owner directed both to be fixed.

## Decision

1. **Tier advancement gains a time floor.** A pattern advances when BOTH
   hold: 3 clean sessions at the current tier (ADR-0002, unchanged) AND
   at least `DAYS_AT_TIER_TO_ADVANCE[tier]` calendar days have elapsed
   since the pattern reached its current tier:
   step 1→2: **7** days, 2→3: **14**, 3→4: **28**, 4→5: **42**,
   5→6: **56**. Cumulative minimum: tier 4 at day 49 (~week 7), tier 6
   at day 147 (~week 21).
   - Rationale: adaptation is time-bound, not session-bound. Session
     counts alone cannot slow frequent users without freezing
     infrequent ones; a time floor paces both nearly equally — which is
     also the product promise (less time ≠ less progress) — and caps
     overuse from over-training.
   - `PatternState` gains `tierSince` (ISO date the current tier was
     reached). Additive and legacy-tolerant: a persisted profile without
     it treats the floor as satisfied once and stamps it on next apply.
     The clean-session requirement still gates capability in that case.
   - Absence interaction: the floor is elapsed calendar time, so time
     off never delays beyond it; capability is still proven by the 3
     clean sessions. Absence never regresses (unchanged).
2. **New simulation ceiling gate (G5).** No consistent persona's median
   full-ladder exhaustion (all five patterns at tier 6) may occur before
   week 18; Gate 1's floor (push tier 4 by week 12 for 4×/week) is
   unchanged. Pacing is now machine-gated in both directions.
3. **Session points are base + duration, showing-up dominant** (owner
   revision during implementation): a completed session earns
   **20 / 25 / 30** points for 10/20/30 minutes — a 15-point base for
   completing any session plus 5 per ten minutes.
   `POINTS.perSessionByMinutes = {10:20, 20:25, 30:30}` replaces
   `perSessionMinute`. The 30-minute spread over the 10-minute drops
   from 3x to 1.5x: longer sessions still visibly earn more, but equal
   consistency is no longer halved. New-tier +5 and skill unlock +25
   unchanged; ledger stays append-only.

## Consequences

Engine: types, apply, spec, sim gates, analysis re-run. App: the finish
screen already renders ledger sums; only fixtures/tests referencing the
old constant change. gamification.md updated. docs/sim-analysis.md
numbers for progression and points are superseded by the re-run.
