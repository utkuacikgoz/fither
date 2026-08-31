# Movement schema — `data/movements.json`

The movement library is the load-bearing data of the whole product: the
engine's guarantees (time budgets, constraint filtering, unbroken
progression ladders) are only as good as this file's integrity. That is why
it is machine-validated (`node scripts/validate-movements.mjs`, also run
automatically by a hook on every edit) and why only the movement-author
agent touches it.

Items marked **PROPOSED** are working defaults pending Brief 1 — the
movement-author session confirms or replaces them, then updates this file
AND the validator together (they must never disagree).

## Shape

Top level: `{ "version": 1, "movements": [Movement, ...] }` — 60 movements.

```jsonc
{
  "id": "kneeling-push-up",        // kebab-case, unique, stable forever
  "name": "Kneeling Push-Up",       // display name (fither-voice rules apply)
  "pattern": "push",                // see pattern list below
  "tier": 2,                        // 1..6
  "progressionTo": "incline-push-up", // id of the SAME pattern's next step; null only at tier 6
  "silent": true,                   // no impact/jumping; safe with a sleeping child nearby
  "equipment": "none",              // "none" | "chair" | "wall" (nothing else exists in this product)
  "loads": ["shoulders", "wrists"], // body areas for the daily "anything sore?" filter
  "unilateral": false,
  "timing": {                       // what makes time budgets computable
    "type": "reps",                 // "reps" | "seconds"
    "defaultValue": 8,              // reps count or hold seconds
    "secondsPerRep": 4              // required when type is "reps"
  },
  "cues": [                         // 2-4 coaching cues; voice scripts generate from these
    "Hands under shoulders",
    "One straight line from knees to head"
  ]
}
```

## Patterns (decided, ADR-0002)

`push`, `pull`, `squat`, `hinge`, `core`. Five ladders of six tiers = 30
of the 60 movement slots; the rest buy variety within patterns. Hinge
stays separate from squat on purpose — posterior-chain work is what this
audience most lacks, and merging would let the engine prescribe all-quad
weeks.

Pull with no equipment is the hard one — expect towel rows, table rows,
prone pulls. That difficulty is exactly why the ladder rules below are
machine-checked and not vibes.

## Body areas (PROPOSED)

`shoulders`, `wrists`, `elbows`, `back`, `hips`, `knees`, `ankles`, `core`.

## Integrity rules (enforced by the validator)

1. Every `id` unique and kebab-case; every `progressionTo` resolves to an
   existing movement of the **same pattern** at **exactly tier + 1**.
2. `progressionTo` is null iff tier is 6.
3. Every pattern has an unbroken ladder: at least one movement at every
   tier 1 through 6, connected by progressions.
4. No orphans: every movement above tier 1 is some lower movement's
   `progressionTo`.
5. **The constraint gate:** filtering to `silent: true` AND equipment in
   {none, chair, wall} must still leave at least one movement at every
   tier 1–4 of every pattern. A wall counts as always available — every
   home has one; "no gear" means nothing you could lack. This gate is what
   guarantees the quiet-flat-no-gear user a real session, and it is the
   easiest guarantee to silently break when editing one movement.
6. `timing` is complete enough to estimate block duration (the engine's
   time-budget gate depends on it).

## Change protocol

Any schema change updates, in one commit: this file, the validator, the
engine types, and the data. A schema change without all four is a bug.
