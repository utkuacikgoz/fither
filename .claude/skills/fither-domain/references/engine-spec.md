# Engine spec — session generation and progression

This file is the law for `packages/engine`. When Brief 2 lands, paste it
verbatim into the "Brief 2" section below and delete any proposed default it
overrides. Until then, items marked **PROPOSED** are working defaults chosen
so build can start — confirm or replace them, then record the decision as an
ADR.

## Contract

```
generateSession(library, profile, history, prompt, seed) -> Session
applySessionResult(library, profile, history, result) -> ApplyResult
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
- Session points (decided, ADR-0008 as owner-revised): base + duration
  with showing up dominating — a completed session earns
  `POINTS.perSessionByMinutes` = 20/25/30 for 10/20/30 minutes (base 15
  + 5 per ten minutes; "ten minutes is complete" caps the spread at
  1.5x). Requires at least one completed block; a fully skipped session
  earns nothing and loses nothing.
- Pattern absence (gate 4) is measured in TRAINING days, not calendar
  days — calendar measurement would punish time off, contradicting
  "absence never regresses".

## Show the adaptation (ADR-0006 — implemented)

The session preview explains, in plain language, why today's session fits
the prompt answers. The reason comes from the engine: `Session` carries a
required, typed `adaptations: Adaptation[]` (reason keys + params in
`types.ts`; the UI maps keys to strings.ts and never re-derives). An empty
list means today's answers did not alter the prescription.

Kinds, in emission order (importance): `soreness {areas}`, `quiet`,
`lowEnergy`, `softLanding {pattern}` (one per volume-reduced pattern that
got a block), `staleFocus {pattern}`, `tasteBlock {pattern, movementId}`.
There is deliberately no `shortSession` kind — ten minutes is complete,
never an adaptation.

**Honesty rule:** a reason is emitted only when it actually changed
today's session. Soreness/quiet fire only when the filter excluded at
least one movement every other constraint would have allowed (an empty
avoid list, or a quiet request over an already-all-silent pool, says
nothing — note the current library is entirely silent, so `quiet` never
fires against it today). `lowEnergy` fires only when energy — not a soft
landing — cut a block's sets. `staleFocus` fires for the top-priority
pattern when its absence (in training days, capped at history length so
new users aren't "stale") reaches `STALE_FOCUS_MIN_TRAINING_DAYS` = 3
(**PROPOSED**) and it received a block. `tasteBlock` mirrors an actually
appended taste block.

## Progression rules

- **Advance (decided, ADR-0002):** a pattern's tier increases after **3**
  clean sessions at the current tier (clean = at least one current-tier
  block for the pattern completed, and none struggled — skipped blocks
  are ignored, ADR-0012). Counter resets on a struggled block.
- **Time floor (decided, ADR-0008):** advancement ALSO requires
  `DAYS_AT_TIER_TO_ADVANCE[tier]` calendar days since the pattern reached
  its current tier — 1→2: 7, 2→3: 14, 3→4: 28, 4→5: 42, 5→6: 56
  (cumulative minimum: tier 4 at day 49, tier 6 at day 147). `tierSince`
  is stamped on every tier change, advance and regress alike. Clean
  sessions keep banking while the floor is unmet; the tier moves on the
  first clean session where both conditions hold. A persisted state
  without `tierSince` (legacy) treats the floor as satisfied once and is
  stamped on its next applied session; fresh profiles carry no stamp (the
  engine has no clock), so a new user's tier-1 floor runs from her first
  session. The floor is elapsed calendar time, so absence never delays
  beyond it — and absence still never regresses.
- **Regress (decided, ADR-0003, inputs revised by ADR-0012):** only on
  repeated in-session failure — 2 consecutive sessions with a
  **struggled** block for the pattern reduce volume at the same tier; a
  3rd consecutive one drops one tier — but never below
  `regressionFloor` = `max(1, earnedTier - 1)` (ADR-0026 as narrowed by
  the owner 2026-09-08). An earned tier is not a ratchet: the ordinary
  drop still reaches one tier under it. What earning buys is a hard
  bottom — she can fall that one tier and no further — and that a tier
  calibration merely PLACED her at can be corrected all the way back to
  the earned mark. Once she is on the floor, repeated struggle answers
  with the volume-reduced soft landing where she stands. Any clean
  session resets the counter. **Absence never regresses.**
- **Skip is progression-neutral (decided, ADR-0012):** a skipped block
  counts neither as completed nor as struggled — no clean-session
  credit, no easing or regression signal, no points. A session where
  every current-tier block for a pattern was skipped leaves that
  pattern's state exactly as absence would (not even a `tierSince`
  stamp), though the session still enters history and still counts for
  pattern-coverage recency (the pattern was prescribed).
- A 2×/week user who keeps showing up must never fall more than one tier
  below one she earned — this is a simulation gate, not a preference
  (re-scoped 2026-09-08, ADR-0026: a tier calibration placed her at was
  never earned, and the ordinary one-tier drop of ADR-0003 was never
  taken away).
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
| 2 | A 2×/week user never falls more than one tier below a tier she EARNED (owner decision 2026-09-08, ADR-0026) |
| 3 | No generated session exceeds its time budget |
| 4 | No pattern is absent for more than 7 days of a user's training |

**Gate 2, earned tiers (owner decision 2026-09-08, ADR-0026, narrowed
the same day).** A tier is EARNED when the ordinary clean-count +
time-floor rule put the pattern there (`earnedTier`, defaulting to the
current tier for any profile persisted without it, so no migration loses
ground). Two kinds of tier drop are legitimate and neither counts as a
regression for this gate:

1. **A calibration placement being corrected.** A tier starting-level
   calibration merely placed her at was never earned, so unwinding it —
   all the way down to `earnedTier` — is not taking something away.
2. **The ordinary struggle-driven drop.** ADR-0003's third consecutive
   struggled session still drops one tier off an earned one. An earned
   tier is a bottom, not a ratchet.

The engine enforces both at once with a single floor:
`regressionFloor(state)` = `max(1, earnedTier - 1)`. So the gate is
whatever is left over — a pattern sitting MORE than one tier below what
she earned. Be honest about what that measures: because the floor is
enforced inside `applySessionResult`, the gate can only fail if the
engine breaks its own rule. It is an end-to-end invariant assertion over
the whole run, not a behavioural discovery the sim could make on its
own. The numbers that carry real signal are the two informational
counts printed beside it — ordinary struggle-driven drops from an earned
tier, and calibration placement corrections. `pnpm sim` prints all
three; the gate is the first and must be 0.

Consequence to keep in view: a pattern that climbed the ladder normally
can still lose a tier to repeated struggle, and a milestone tier (4, 6)
can therefore be dropped out of — the milestone itself is remembered for
life (`unlockedMilestones`) and never re-awarded. Below the floor, the
response to repeated struggle is the volume-reduced soft landing where
she stands.

If Gate 1 fails, fix the engine or the movement ladders. Nothing downstream
gets built until it passes.

ADR-0008 adds a ceiling gate:

| # | Gate |
|---|---|
| 5 | No consistent persona's MEDIAN full-ladder exhaustion (all five patterns at tier 6) before week 18; never within 26 weeks passes |

Pacing is machine-gated in both directions: G1 is the floor, G5 the
ceiling. Erratic has no consistent cadence and is reported for
information only.

## Brief 2 (paste verbatim when available)

> TODO: paste Brief 2 here, unchanged. It overrides every PROPOSED default
> above. Also file `docs/briefs/brief-2.md`.
