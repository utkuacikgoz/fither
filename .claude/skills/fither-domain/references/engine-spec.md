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
  passes the date inside `prompt` and a `seed` for the RNG. Same inputs, same
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
  (low|okay|strong), `quiet` (bool), `avoid` (body areas), `date` (ISO
  yyyy-mm-dd), `equipment` (available equipment, from settings; wall is
  always considered available).

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
   tier for that pattern (falling down the ladder only if today's
   constraints empty the tier). Low energy → same tier, reduced sets,
   never a tier drop. Strong energy → full volume plus optionally one
   "taste" block of the next tier late in the session.

## Prescription constants (validated by sim, ADR-0006)

Firmed up from PROPOSED during implementation; the Gate 1 run below is
what ratifies them. They live in `packages/engine/src/generate.ts`.

- Transition/setup: 20s charged per block. Rest between sets: 45s,
  padded up to 90s (rest-only padding — never extra volume) to land the
  session in 90–100% of budget.
- Sets: 3 per block; 2 when energy is low or the pattern is
  volume-reduced; blocks shrink to a 2-set minimum to fit the budget.
  Unilateral movements are charged double work time (both sides).
- Taste block: strong energy only — one block, one set, next tier,
  appended last, 60s reserved. Taste blocks never count for or against
  progression.
- `atNewTier` marks the first session at a freshly advanced tier. A
  regression lands the user volume-reduced at the lower tier (soft
  landing).
- Session points (1/min) require at least one completed block; a fully
  skipped session earns nothing and loses nothing.
- Pattern absence (gate 4) is measured in TRAINING days, not calendar
  days — calendar measurement would punish time off, contradicting
  "absence never regresses".

## Show the adaptation (ADR-0006 — next contract addition)

The session preview must explain, in one plain-language line, why today's
session fits the prompt answers ("Quiet mode: everything floor-based
today"). The reason comes from the engine: `Session` gains a typed
`adaptations` field (reason keys + params; UI maps keys to strings.ts).
Not yet in `types.ts` — implement as the first post-Gate-1 engine change,
additive only.

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
