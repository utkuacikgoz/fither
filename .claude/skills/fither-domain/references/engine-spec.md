# Engine spec — session generation and progression

This file is the law for `packages/engine`. When Brief 2 lands, paste it
verbatim into the "Brief 2" section below and delete any proposed default it
overrides. Until then, items marked **PROPOSED** are working defaults chosen
so build can start — confirm or replace them, then record the decision as an
ADR.

## Contract

```
generateSession(library, profile, history, prompt, seed) -> Session
applySessionResult(profile, history, result) -> { profile, history }
```

- Pure functions. No IO, no clock reads, no `Math.random` — the caller
  passes `now` inside `prompt` and a `seed` for the RNG. Same inputs, same
  session, always. This is what makes the simulation trustworthy and bugs
  reproducible.
- The engine is the ONLY place progression and prescription logic lives.
  The UI renders what the engine returns; it never re-derives a rule.

## Inputs

- **library** — parsed `data/movements.json`.
- **profile** — per-pattern tier state, e.g. `{ push: 2, pull: 1, ... }`,
  plus per-pattern clean-session counters.
- **history** — completed sessions with per-block outcomes
  (completed / struggled / skipped) and dates.
- **prompt** — today's answers: `minutes` (10|20|30), `energy`
  (low|okay|strong), `quiet` (bool), `avoid` (body areas), `now` (date).

## Session construction rules

1. **Time budget is a hard ceiling.** Estimated session time (work blocks +
   rests + transitions, from movement timing data) must be ≤ the chosen
   budget. Never over; aim within 90–100% of it.
2. **Constraint filtering first.** `quiet` keeps only `silent: true`
   movements; equipment available keeps only matching movements; `avoid`
   areas exclude movements loading them. The library guarantees tiers 1–4
   survive the silent + chair + no-gear filter, so a valid session always
   exists.
3. **Pattern coverage.** Across any rolling window of training days, no
   pattern goes unprescribed for more than 7 days. A 10-minute session
   cannot cover everything — the engine tracks per-pattern recency and
   prioritises the stalest patterns.
4. **Prescription at current tier.** Movements come from the user's current
   tier for that pattern. Low energy → PROPOSED: same tier, reduced volume
   (fewer reps/sets), never a tier drop. Strong energy → full volume,
   optionally one "taste" block of the next tier's movement late in the
   session.

## Progression rules

- **Advance (decided, ADR-0002):** a pattern's tier increases after **3**
  clean sessions at the current tier (clean = all blocks for that pattern
  completed without "struggled"). Counter resets on a struggled block.
- **Regress (decided, ADR-0003):** only on repeated in-session failure —
  2 consecutive sessions with the pattern's blocks marked
  struggled/skipped reduce volume at the same tier; a 3rd consecutive one
  drops one tier. Any clean session resets the counter.
  **Absence never regresses.**
  A 2×/week user who keeps showing up must never lose a tier — this is a
  simulation gate, not a preference.
- Tier 6 is terminal; continued progress there is volume and density.

## Simulation harness (`packages/engine/sim`)

500 simulated users, 26 weeks. Personas at minimum: 4×/week consistent,
2×/week consistent, erratic (random 0–4×/week), quiet-constrained
(always `quiet: true`), 10-minute-only. User behaviour models
(struggle probability by tier gap, etc.) live in the harness, not the
engine, and are seeded — the whole run is reproducible from one seed.

`pnpm sim` prints the gate numbers and exits non-zero if any gate fails.
Report the printed numbers after every engine change; never just "passes".

## Acceptance gates (Gate 1 — verbatim, not proposed)

| # | Gate |
|---|---|
| 1 | A 4×/week user reaches push tier 4 or higher by week 12 |
| 2 | A 2×/week user never regresses a tier |
| 3 | No generated session exceeds its time budget |
| 4 | No pattern is absent for more than 7 days of a user's training |

If Gate 1 fails, fix the engine or the movement ladders. Nothing downstream
gets built until it passes.

## Brief 2 (paste verbatim when available)

> TODO: paste Brief 2 here, unchanged. It overrides every PROPOSED default
> above. Also file `docs/briefs/brief-2.md`.
