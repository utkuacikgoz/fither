# Simulation deep-dive — how users actually progress

> **Superseded in part (ADR-0008).** The progression and points numbers
> below describe the PRE-ADR-0008 engine (no time floors, 1 point/min)
> and drove that ADR. For current numbers see
> [Post-ADR-0008 re-run](#post-adr-0008-re-run) at the end. The
> structural findings (lockstep patterns, quiet no-op, dead regression
> path) still hold.

Every number in this document comes from a real run of
`packages/engine/sim/analyze.ts`, which replays the exact same 500-user /
26-week simulation that `pnpm sim` gates on (same personas, same behaviour
model, same RNG consumption order — it observes, it never forks). Reproduce
with:

```
pnpm --filter @fither/engine exec tsx sim/analyze.ts
```

**Run parameters:** seed 20260831 (the gated seed), 500 users, 26 weeks,
36785 sessions (0 empty), calendar starting Monday 2026-01-05, equipment
`["chair"]`. Personas: consistent4=84, consistent2=84, lowCapability2=83,
erratic=83, quiet=83, tenMin=83. Stability cross-checked against second
seed 20270101 (last section). Gate run on the same seed: G1–G4 all PASS
(84/84 push tier ≥4 by week 12 median week 3; 0 regressions; 0 over
budget; max absence 3 training days).

## Headline findings

These are the things to feel for at Gate 2 and to put in front of the
coach. None of them is a failing gate; several are product questions the
gates cannot see.

1. **Everyone exhausts the ladder by week 8–12.** Median tier is 6 in all
   five patterns by week 4 (consistent4), week 8 (consistent2, quiet,
   tenMin), or week 12 (lowCapability2, erratic). Every persona's plateau
   is tier-limited (hit terminal tier 6), never cadence-limited — even
   2×/week users spend the last 14+ of 26 weeks with nothing left to
   unlock. Mechanism: 20/30-minute sessions cover all five patterns ~99%
   of the time, so every session ticks every pattern's clean counter, and
   3 clean sessions per tier (ADR-0002) means tier 6 in ~15 sessions.
   Caveat: the harness's capability model (+0.3 tier-equivalents per clean
   session) is almost certainly faster than real strength gain — wall
   push-up to the hardest tier-6 push variant in 8 weeks of 2×/week is not
   a human trajectory. The sim proves the engine will take a
   never-struggling user to tier 6 that fast, not that real users will
   get there. **Ask the coach** whether advancement should demand more
   per-pattern volume (e.g. clean *blocks*, not clean sessions that
   brushed the pattern once), and expect real-world pacing to come from
   real struggle rates, which we don't have yet.

2. **The first skill unlock lands early for everyone — not a concern.**
   The 2×/week personas get their first tier-4 unlock at median week 5
   (p10–p90: 5–5 for the first pattern; worst per-pattern p90 is week 6).
   The erratic persona is the slowest at median week 5, p90 week 7–8 per
   pattern. 0 of 500 users finished 26 weeks without an unlock. The ~10
   week flag threshold is never approached.

3. **The regression path never fires: 0/500 users ever dropped a tier.**
   Volume-reduction (2 struggles) does fire — lowCapability2 averages 1.61
   episodes per user and starts 3.0% of her sessions volume-reduced — and
   the soft landing rescued **100% of 189 rescue opportunities** across
   all personas (a rescue = a volume-reduced pattern trained at its
   current tier coming out clean). Honesty note: part of that 100% is by
   construction — the behaviour model deterministically completes a
   volume-reduced prescription within capability. The practical upshot:
   Gate 2 passes, but the 3-struggle tier drop is exercised only by unit
   tests, never by the simulation. If real users regress, we are trusting
   code the population-level sim has never walked through.

4. **Quiet mode is currently a no-op.** The quiet persona (always
   `quiet: true`, 3×/week) triggered the below-tier constraint fallback in
   0 of 6474 sessions, and progresses exactly like an unconstrained
   3×/week user (tier 4 median week 3). Reason: all 60 movements in the
   library are `silent: true`, so the quiet filter never excludes
   anything (already noted in ADR-0006/engine-spec). Product question:
   either non-silent movements are coming (jumps, plyo) and this wakes
   up, or the quiet question in the daily prompt is dead weight today.
   The only persona that ever hits the fallback is erratic (4.0% of
   sessions), driven by her occasional `avoid` areas.

5. **10-minute-only users do not starve — but they earn half the
   points.** tenMin covers only 2–3 patterns per session (10-min sessions:
   48.7% cover exactly 2 patterns), yet the stalest-first rotation holds
   max pattern absence to 3 training days and she reaches tier 4
   everywhere by median week 4. However, at the *same* session count as
   consistent4 (median 104 sessions), she ends week 26 with 1410 points
   vs 3125 — points-per-minute makes equal consistency worth less than
   half. That is a gamification design question (Brief on gamification /
   share card), not an engine bug, but the owner should decide whether
   showing up 4×/week for 10 minutes should feel half as rewarded.

6. **After the ladder is done, strong energy stops paying.** Taste-block
   rate on strong-energy sessions runs 15.3% (consistent4) to 39.8%
   (erratic) — inversely tied to how quickly the persona reaches tier 6,
   because at tier 6 there is no next tier to taste. Combined with
   finding 1, a long-tenured user's "strong" answer changes nothing.
   More fuel for the tier-6 content-runway conversation.

## 1. Tier progression curves (median tier per pattern)

Snapshots at end of weeks 4 / 8 / 12 / 26. Every persona's five patterns
move in lockstep (multi-pattern sessions advance them together), so each
table is uniform across patterns — itself a finding: progression has no
per-pattern texture in the current model.

**consistent4** (84 users)

| pattern | w4 | w8 | w12 | w26 |
|---|---|---|---|---|
| push | 6 | 6 | 6 | 6 |
| pull | 6 | 6 | 6 | 6 |
| squat | 6 | 6 | 6 | 6 |
| hinge | 6 | 6 | 6 | 6 |
| core | 6 | 6 | 6 | 6 |

**consistent2** (84 users)

| pattern | w4 | w8 | w12 | w26 |
|---|---|---|---|---|
| push | 3 | 6 | 6 | 6 |
| pull | 3 | 6 | 6 | 6 |
| squat | 3 | 6 | 6 | 6 |
| hinge | 3 | 6 | 6 | 6 |
| core | 3 | 6 | 6 | 6 |

**lowCapability2** (83 users)

| pattern | w4 | w8 | w12 | w26 |
|---|---|---|---|---|
| push | 3 | 5 | 6 | 6 |
| pull | 3 | 5 | 6 | 6 |
| squat | 3 | 5 | 6 | 6 |
| hinge | 3 | 5 | 6 | 6 |
| core | 3 | 5 | 6 | 6 |

**erratic** (83 users)

| pattern | w4 | w8 | w12 | w26 |
|---|---|---|---|---|
| push | 3 | 5 | 6 | 6 |
| pull | 3 | 5 | 6 | 6 |
| squat | 3 | 5 | 6 | 6 |
| hinge | 3 | 5 | 6 | 6 |
| core | 3 | 5 | 6 | 6 |

**quiet** (83 users)

| pattern | w4 | w8 | w12 | w26 |
|---|---|---|---|---|
| push | 5 | 6 | 6 | 6 |
| pull | 5 | 6 | 6 | 6 |
| squat | 5 | 6 | 6 | 6 |
| hinge | 5 | 6 | 6 | 6 |
| core | 5 | 6 | 6 | 6 |

**tenMin** (83 users)

| pattern | w4 | w8 | w12 | w26 |
|---|---|---|---|---|
| push | 4 | 6 | 6 | 6 |
| pull | 4 | 6 | 6 | 6 |
| squat | 4 | 6 | 6 | 6 |
| hinge | 4 | 6 | 6 | 6 |
| core | 4 | 6 | 6 | 6 |

Plateau classification: **tier-limited for every persona** (median 6
everywhere by week 12). No persona is cadence-limited over 26 weeks.

## 2. Weeks to first skill unlock (tier 4) — median [p10, p90]

"First (any pattern)" is the retention moment: the first time she sees a
skill-unlock card at all. Tier 4 as the unlock tier is the PROPOSED
`SKILL_MILESTONE_TIERS = [4, 6]` default.

| persona | first (any pattern) | push | pull | squat | hinge | core | never any |
|---|---|---|---|---|---|---|---|
| consistent4 | 3 [3, 3] | 3 [3, 3] | 3 [3, 3] | 3 [3, 3] | 3 [3, 3] | 3 [3, 3] | 0/84 |
| consistent2 | 5 [5, 5] | 5 [5, 6] | 5 [5, 6] | 5 [5, 6] | 5 [5, 6] | 5 [5, 5] | 0/84 |
| lowCapability2 | 5 [5, 5] | 5 [5, 6] | 5 [5, 6] | 5 [5, 6] | 5 [5, 6] | 5 [5, 6] | 0/83 |
| erratic | 5 [3, 7] | 6 [4, 8] | 6 [4, 8] | 6 [4, 8] | 6 [4, 8] | 6 [4, 8] | 0/83 |
| quiet | 3 [3, 3] | 3 [3, 4] | 3 [3, 4] | 3 [3, 3] | 3 [3, 4] | 3 [3, 3] | 0/83 |
| tenMin | 4 [3, 4] | 4 [4, 5] | 4 [3, 5] | 4 [4, 5] | 4 [4, 5] | 4 [3, 5] | 0/83 |

No persona's median exceeds the ~10-week concern threshold; the worst p90
anywhere is week 8 (erratic).

## 3. Points trajectory (median cumulative points)

Bonus sessions = % of sessions whose ledger includes at least one
`newTierBlock` (+5) or `skillUnlock` (+25) event, on top of the 1/minute
session points.

| persona | w1 | w4 | w12 | w26 | sessions/user (median) | bonus sessions |
|---|---|---|---|---|---|---|
| consistent4 | 140 | 790 | 1662.5 | 3125 | 104 | 10.6% |
| consistent2 | 40 | 245 | 955 | 1600 | 52 | 20.3% |
| lowCapability2 | 50 | 230 | 930 | 1575 | 52 | 27.6% |
| erratic | 30 | 195 | 890 | 1435 | 51 | 31.7% |
| quiet | 60 | 445 | 1100 | 1940 | 78 | 13.0% |
| tenMin | 40 | 320 | 850 | 1410 | 104 | 20.9% |

The bonus rate is *higher* for slower personas: bonuses are tied to tier
arrivals, so a persona that finishes the ladder in 4 weeks (consistent4)
spends 22 weeks earning flat 1/minute. See headline findings 5 and 6.

## 4. Struggle economics

Rescue = a volume-reduced pattern that received current-tier work this
session; clean = the reduction was lifted (no regression, no repeat
struggle). Reduction episodes are `volumeReduced` false→true transitions.

| persona | struggled-session rate | reduction episodes/user | users ever regressed | sessions started volume-reduced | rescue: clean / opportunities |
|---|---|---|---|---|---|
| consistent4 | 8.2% | 0.27 | 0/84 | 23 (0.3%) | 23/23 (100.0%) |
| consistent2 | 9.0% | 0.19 | 0/84 | 16 (0.4%) | 16/16 (100.0%) |
| lowCapability2 | 22.6% | 1.61 | 0/83 | 131 (3.0%) | 134/134 (100.0%) |
| erratic | 9.2% | 0.05 | 0/83 | 5 (0.1%) | 4/4 (100.0%) |
| quiet | 7.2% | 0.19 | 0/83 | 16 (0.2%) | 16/16 (100.0%) |
| tenMin | 5.0% | 0.14 | 0/83 | 22 (0.3%) | 12/12 (100.0%) |

(Opportunities can exceed reduced-session counts when multiple patterns
are reduced at once, and fall short when a 10-minute session doesn't
train the reduced pattern that day.)

The soft landing works perfectly *in this behaviour model*: one
volume-reduced session and the user is clean again, every time, so nobody
ever reaches the 3-struggle tier drop. See headline finding 3 for why
that is a caveat as much as a comfort.

## 5. Session composition

**10 min** (9908 sessions)
- blocks/session: 2: 35.5%, 3: 48.0%, 4: 16.4%, 5: 0.1%
- distinct patterns/session: 2: 48.7%, 3: 37.4%, 4: 13.8%, 5: 0.1%

**20 min** (17665 sessions)
- blocks/session: 4: 0.0%, 5: 72.8%, 6: 11.6%, 7: 3.0%, 8: 11.2%, 9: 1.3%
- distinct patterns/session: 3: 0.3%, 4: 0.8%, 5: 99.0%

**30 min** (9212 sessions)
- blocks/session: 7: 42.4%, 8: 35.9%, 9: 6.5%, 10: 15.1%, 11: 0.0%, 12: 0.1%
- distinct patterns/session: 3: 0.4%, 4: 1.0%, 5: 98.6%

Fallback (any block below the pattern's current tier) and taste rates:

| persona | sessions with a below-tier fallback | taste blocks / strong-energy sessions |
|---|---|---|
| consistent4 | 0/8736 (0.0%) | 336/2197 (15.3%) |
| consistent2 | 0/4368 (0.0%) | 324/1073 (30.2%) |
| lowCapability2 | 0/4316 (0.0%) | 421/1124 (37.5%) |
| erratic | 171/4259 (4.0%) | 416/1046 (39.8%) |
| quiet | 0/6474 (0.0%) | 299/1517 (19.7%) |
| tenMin | 0/8632 (0.0%) | 584/2119 (27.6%) |

The quiet persona never needs the fallback (headline finding 4): the
all-silent library means quiet filtering removes nothing. Only erratic's
occasional avoid areas ever push a prescription down the ladder.

## 6. Budget utilization (non-empty sessions)

| length | min | median | max | 90–92% | 92–94% | 94–96% | 96–98% | 98–100% |
|---|---|---|---|---|---|---|---|---|
| 10 min | 90.0% | 91.5% | 100.0% | 50.5% | 7.2% | 15.1% | 9.0% | 18.2% |
| 20 min | 90.0% | 99.1% | 100.0% | 9.0% | 15.2% | 10.2% | 10.2% | 55.3% |
| 30 min | 90.0% | 95.4% | 100.0% | 24.0% | 12.0% | 17.6% | 19.3% | 27.0% |

Everything sits inside the 90–100% band (Gate 3 corroborated at
distribution level). 10-minute sessions cluster at the bottom of the band
— block granularity is coarse relative to a 600-second budget — while
20-minute sessions most often fill to 98–100%.

## Stability check — second seed

The full analysis was re-run with seed 20270101 (same 500 users, 26
weeks; 36879 sessions). Key metrics are effectively identical:

| persona | first unlock (median wk) | mean tier @w26 | median points @w26 |
|---|---|---|---|
| | 20260831 / 20270101 | 20260831 / 20270101 | 20260831 / 20270101 |
| consistent4 | 3 / 3 | 6.0 / 6.0 | 3125 / 3120 |
| consistent2 | 5 / 5 | 6.0 / 6.0 | 1600 / 1600 |
| lowCapability2 | 5 / 5 | 6.0 / 6.0 | 1575 / 1575 |
| erratic | 5 / 5 | 6.0 / 6.0 | 1435 / 1465 |
| quiet | 3 / 3 | 6.0 / 6.0 | 1940 / 1940 |
| tenMin | 4 / 4 | 6.0 / 6.0 | 1410 / 1410 |

The findings above are properties of the model, not of one lucky seed.

## Method notes and caveats

- `analyze.ts` mirrors `run.ts`'s RNG consumption exactly; with seed
  20260831 it observes the same 36785 sessions the gates were scored on.
  It never modifies the engine or the behaviour model.
- Tier-4 as the "skill unlock" tier is the PROPOSED
  `SKILL_MILESTONE_TIERS = [4, 6]` default; if Brief 2 changes the
  milestone tiers, section 2 must be re-run.
- The struggle model (personas.ts) drives everything downstream of
  generation: struggle probability caps at 50%, volume-reduced work
  within capability always completes, and capability grows ~1 tier per
  3–4 clean sessions. Progression *speed* findings (headline 1) are upper
  bounds set by this model; the *structural* findings (lockstep patterns,
  quiet no-op, dead regression path, points asymmetry) hold regardless of
  how fast capability grows.

## Post-ADR-0008 re-run

Same harness, same seed 20260831, 500 users, 26 weeks — re-run after
ADR-0008 landed (time floors `DAYS_AT_TIER_TO_ADVANCE` = 7/14/28/42/56
days per step, and base+duration session points 20/25/30 for 10/20/30
minutes per the owner's revision of decision 3). 36755 sessions (0
empty; the count shifts from 36785 because tier pacing changes which
movements are prescribed, which shifts downstream RNG consumption).
Everything in this section supersedes the corresponding numbers above.
Gate run on the same seed: **G1–G5 all PASS** — G1 median week 8
(84/84 by week 12), G2 0 regressions, G3 0 over budget, G4 max absence
3 training days, G5 median exhaustion consistent4=22, consistent2=23,
lowCapability2=23, quiet=22, tenMin=23 (erratic=never, info only).

### Full-ladder exhaustion (all five patterns at tier 6)

Previously week 8–12 for everyone (headline finding 1). Now:

| persona | median week [p10, p90] | never within 26 weeks |
|---|---|---|
| consistent4 | 22 [22, 23] | 0/84 |
| consistent2 | 23 [22, 24] | 0/84 |
| lowCapability2 | 23 [22, 24] | 0/83 |
| erratic | >26 [25, >26] | 44/83 |
| quiet | 22 [22, 23] | 0/83 |
| tenMin | 23 [22, 24] | 0/83 |

The time floors dominate: every consistent cadence exhausts at the
147-day cumulative minimum (~week 22) plus a session or two of slack,
regardless of frequency — which is the product promise (less time ≠
less progress) made literal. The G5 ceiling (week 18) clears by 4+
weeks; only ~14% of the run now happens post-exhaustion instead of
~55%. A side effect: taste blocks on strong-energy sessions jumped from
15–40% to 80–93%, because users now spend most of the run below tier 6
where a next tier exists to taste.

### Weeks to first skill unlock (tier 4) — median [p10, p90]

Floor-bound at the 49-day cumulative minimum (~week 8) for every
consistent persona; previously week 3–6.

| persona | first (any pattern) | worst per-pattern p90 | never any |
|---|---|---|---|
| consistent4 | 8 [8, 8] | 8 | 0/84 |
| consistent2 | 8 [8, 8] | 9 | 0/84 |
| lowCapability2 | 8 [8, 8] | 9 | 0/83 |
| erratic | 10 [8, 11] | 12 | 0/83 |
| quiet | 8 [8, 8] | 8 | 0/83 |
| tenMin | 8 [8, 8] | 9 | 0/83 |

The retention moment moved from week 3–5 to week 8–10. Still under the
~10-week concern threshold at the median, but only just — erratic's
median IS week 10 with p90 at 12. Worth a product eye: the first
skill-unlock card now lands two months in for everyone.

### Points at week 26 (median cumulative, new 20/25/30 scheme)

| persona | w26 points | sessions/user (median) | previous w26 (1/min) |
|---|---|---|---|
| consistent4 | 3330 | 104 | 3125 |
| consistent2 | 1780 | 52 | 1600 |
| lowCapability2 | 1775 | 52 | 1575 |
| erratic | 1655 | 51 | 1435 |
| quiet | 2340 | 78 | 1940 |
| tenMin | 2455 | 104 | 1410 |

The parity fix does what it was asked to: tenMin at the same session
count as consistent4 (104) now earns 74% of her points instead of 45%
— duration still pays visibly (a 30-min session earns 1.5x a 10-min
one) but showing up dominates. Bonus-session rates rose slightly
across the board (progression events now spread over 22 weeks instead
of clustering in the first 8).

### Stability

Re-run with second seed 20270101 (36861 sessions): first-unlock medians
identical (erratic 9 vs 10), exhaustion medians identical for all
consistent personas (erratic 26 vs >26), points within 0–45 of the
primary seed for every persona. The floors make the pacing findings
even more seed-independent than before, since calendar time, not RNG,
now sets the tempo.
