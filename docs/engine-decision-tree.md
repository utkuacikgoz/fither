# From her four answers to today's session: the decision tree

How `generateSession` (`packages/engine/src/generate.ts`) turns the daily
prompt into a session, in the order it actually applies each rule. Every
node names its function. The coverage audit (`pnpm --filter @fither/engine
coverage`, `packages/engine/sim/coverage.ts`) walks the whole input space
this tree accepts; its invariants are pinned in
`packages/engine/__tests__/coverage.test.ts`.

## Inputs

| answer | values | where it enters |
|---|---|---|
| Minutes | 10, 20, 30 | `budget = minutes * 60` |
| Energy | low, okay, strong | sets per block; the taste block |
| Quiet | yes / no | `quietOk`: drops movements with `silent: false` |
| Sore today + Always work around | any subset of 8 areas, merged by the app (`daily-prompt-screen.tsx`, `finish`) | `avoidOk`: drops any movement whose `loads` touch an avoided area |
| Equipment | floor only (`none`,`wall`) or with chair (`none`,`chair`,`wall`) | `equipmentOk`: wall and bodyweight always pass |
| Profile | tier 1..6 per pattern, `volumeReduced`, counts | tier to prescribe; sets |
| History | past sessions | pattern order (staleness); nothing else |
| Seed | hash(date, per-user salt) (`app/src/session/seed.ts`) | tie-breaks only |

## The tree

```
1. Budget            budget = minutes * 60 seconds                            generate.ts:132
   strong energy     mainBudget = budget - 60 s held back for the taste block  generate.ts:181
   otherwise         mainBudget = budget

2. Pool              every movement passing quietOk AND equipmentOk AND avoidOk  movementEligible
   quiet             library is all-silent today, so quiet never removes anything
                     (audit: 165,888 quiet prompts identical to their loud twin)
   equipment         wall and bodyweight always in; chair movements only with a chair
   avoid             one avoided area removes every movement that loads it

3. Pattern order     stalest pattern first (training days since it last appeared,
                     trainingDaysSincePattern), ties by seeded shuffle          generate.ts:154-163

4. Pattern cap       5 patterns available -> 2 blocks each; 4 -> 3; 3 or fewer -> 4  maxBlocksPerPattern
                     (fewer survivors carry more blocks so the budget still fills)

5. Rounds            round 1: one block per pattern in order (coverage before volume)
                     rounds 2..cap: another helping per pattern while budget allows   generate.ts:229-236
   per block         pickMovement(pattern, tier):
                       at the profile's tier, prefer a movement not yet used today;
                       if every movement at that tier is already used, REPEAT one;
                       only when the tier has NO eligible movement, step down one tier
                       and try again, down to tier 1; none -> pattern skipped        generate.ts:170-183
   sets              low energy or volumeReduced -> 2 sets, else 3; if 3 does not fit
                     the remaining budget, try 2; if 2 does not fit, no block         generate.ts:196-215
   cost              20 s transition + sets x work + (sets-1) x 45 s rest; unilateral
                     work doubles (both sides)                                      blockSeconds
   new tier          first session at a freshly reached tier flags its blocks (bonus)  generate.ts:203-208

6. Taste block       strong energy only: one set of a next-tier movement from a pattern
                     trained today, if the 60 s reserve fits; progression-neutral      generate.ts:240-262

7. Padding           rest lengthened 1 s at a time across blocks (never past 90 s,
                     never volume) until total >= 90% of budget or every rest is maxed  generate.ts:266-281

8. Adaptations       soreness (only if an area actually removed something), quiet (never,
                     today), lowEnergy (only where energy, not budget, cut sets),
                     softLanding, staleFocus, tasteBlock                              generate.ts:285-323

9. Empty session     pool empty for every pattern -> zero blocks. The app then asks
                     unblockingAreas (src/unblocking.ts) which single avoided area, set
                     aside, makes the session build, and offers each as a row.
```

## What the audit found (331,776 prompts, 2026-09-07)

Holds everywhere: never over budget; never a block that loads an avoided
area, needs missing equipment or is loud under quiet; never throws; tiers
at or below the profile's; empty only when the pool is empty (first at
three avoided areas, 44 of the 256 sets); `unblockingAreas` non-empty for
every empty case; one avoided area or none always fills 30 minutes to the
90% target.

Two findings for the owner (not gates; nothing in the app is wrong today):

1. **Underfill with two or more areas.** When the avoid set leaves one or
   two patterns, the pattern cap (4) stops the session short of the
   budget at 20 and 30 minutes: shoulders+hips leaves only core, and 30
   minutes fills to 40% (4 blocks). 7 two-area sets and 32 three-area sets
   underfill (<80%) at 30 minutes; only shoulders+hips and the sets that
   leave a single pattern underfill at 20. Never at 10. The session is
   still honest (the preview states the estimated length), but the promise
   "30 minutes" is not kept.
2. **Repeats.** `pickMovement` repeats a movement before stepping down a
   tier, so a 30-minute session with one area avoided repeats a movement
   in 96% of cases (416/432 for shoulders). At 10 minutes with nothing
   avoided it never repeats. Whether a second block of the same movement
   is acceptable coaching, or the ladder should be walked down for a fresh
   one first, is a coaching decision.

## Which areas each ladder touches

Every movement at the tier loads the "all" areas; "some" lists areas only
part of the tier loads. A single avoided area that appears in "all" for
every tier removes the whole pattern.

| pattern | areas loaded by every tier | removed entirely by one area |
|---|---|---|
| push | shoulders, wrists, elbows (core from tier 5) | shoulders, wrists, elbows |
| pull | shoulders, back (wrists, elbows from tier 5) | shoulders, back |
| squat | hips, knees (ankles from tier 3) | hips, knees |
| hinge | hips (core at tiers 5 and 6) | hips |
| core | core (shoulders from tier 3, wrists at 5 and 6) | core |

So hips removes squat and hinge together; shoulders removes push, pull
and core tiers 3 and up. That is why shoulders+hips leaves core alone and
why the 44 emptying sets all contain hips and core plus shoulders or a
push-side area.
