---
name: fither-domain
description: >-
  FITHER product truth: the promise, the audience, the 10/20/30 session format,
  the daily prompt, the progression engine rules, gamification, the forbidden
  list and pricing. Read this before ANY work on this repo — movements, engine,
  UI, copy, tests, store listing, anything. If a task touches what the product
  does or says, this file decides it, not conversation memory.
---

# FITHER domain — product truth

This file is the single source of product truth. When the product changes,
this file changes first, and every future session inherits the change. If an
instruction elsewhere contradicts this file, stop and flag it.

## The promise

**Strength that fits your life.** And each morning: **a workout that fits
today.** (Taglines decided, ADR-0006.)

Equipment-free calisthenics for time-poor women, in sessions that fit the
day you are actually having — 10, 20 or 30 minutes — adapted daily to your
time, energy and environment. You get measurably stronger without a gym,
without gear, and without the app ever talking about your weight.

Two rules every surface obeys:
- **Ten minutes is complete.** A 10-minute session is a successful
  workout, never a diminished version of a longer one — in copy, in
  design, in points.
- **Show the adaptation.** The user sees, in one plain-language line, why
  today's session fits her answers ("Quiet mode: everything today is
  floor-based" / "Low energy: same movements, lighter volume"). The
  explanation comes from the engine, never invented by the UI.

## The audience

Women with almost no discretionary time: careers, kids, caring
responsibilities. English-speaking market, iOS first. They are not
"beginners" as an identity — they are busy. Many train at home while
someone sleeps in the next room, or in an office or hotel room — which is
why quiet, small-space, no-equipment options are structural requirements,
not edge cases. Secondary audience: frequent travelers. Future audience
(not v1): postpartum mothers — only after specialist review of the
movement library and program rules.

## What FITHER is not (positioning)

Not a weight-loss app, not a calorie tracker, not hardcore bodybuilding,
not a random workout generator, not an AI coach inventing exercises (the
library is expert-authored and fixed), not a social fitness feed. It IS
structured strength progression adapted to real life: flexible without
becoming random, encouraging without being sentimental, premium without
being intimidating.

## The format

- Exactly three session lengths: **10, 20, 30 minutes**. Never more, never
  fewer options. The session must fit its budget — running over is a bug.
- One short **daily prompt** before each session (decided, ADR-0003):
  1. How much time do you have? → 10 / 20 / 30
  2. How is your energy? → low / okay / strong
  3. Do you need to be quiet right now? → yes / no
  4. Anything sore or off-limits today? → one-tap "All good" default,
     optional body-area picks
  Four taps, ~10–15 seconds. Do not add questions — Gate 3 (open to
  first movement in under 60s) spends this budget.
- The answers plus history feed the engine. The engine runs **on device**;
  a paying user in airplane mode gets a full session, always.

## The engine (summary — spec is law)

Full algorithm, thresholds and simulation gates:
`references/engine-spec.md`. That file holds Brief 2 verbatim; when a
question like "does tier advance after 2 or 3 clean sessions?" comes up,
the answer is there, not in a conversation.

Non-negotiables the spec enforces:

- Six tiers per movement pattern. Progression is per-pattern, not global.
- A 2×/week user must never regress. Absence alone never causes regression.
- No pattern disappears for more than 7 days of training.
- The silent + chair-only + no-gear constraint set must still produce a
  complete session at tiers 1–4 for every pattern.

## Gamification

Points ledger and named skill unlocks — capability milestones, never body
metrics. Full rules and the forbidden-mechanics rationale:
`references/gamification.md`.

## The forbidden list (absolute)

These never appear in the product — not in copy, not in data models, not in
analytics, not in settings, not "optional":

- **No weight.** No weigh-ins, no weight goals, no weight-loss framing.
- **No calories.** No burn estimates, no food anything.
- **No body-shape language.** No "tone", "sculpt", "bikini", "problem
  areas", no before/after. Progress is what your body can DO.

If a feature idea needs one of these to work, the feature is wrong for this
product. Flag it; do not build it.

**Streaks (owner decision 2026-09-06, ADR-0018).** FITHER keeps a day
streak: consecutive calendar days with at least one completed block, one
missed day per run forgiven as a rest day, the best run kept. It shows on
the hub, the finish screen, Progress, and may be named in the daily
invitation. The no-guilt rule still governs its words: a missed day is a
rest day, never a failure; no "don't break the chain", no "we miss you".

## Pricing (decided, ADR-0014 — supersedes ADR-0002's prices)

Subscription via RevenueCat: **$12.99/month or $59.99/year, 7-day free
trial** (USD reference prices; other storefronts via Apple's price
tiers). Annual is the plan we lead with on the paywall. A **$99 lifetime**
purchase exists but is never on the paywall: it is offered once, on day 3
of the trial, only to someone who has switched off auto-renew. No
countdowns, no "last chance" — we say we'll only ask once, and we don't.
The free week is the store's introductory offer, started from the
paywall; the paywall never blocks the first session, and gates only new
sessions after it until the store entitles her. Entitlements must work
offline once granted — a paying user in airplane mode is never locked
out.

## Movement library

`data/movements.json` is the source of truth for the 60 movements. Schema
and integrity rules: `references/movement-schema.md`. Only the
movement-author agent edits it, and every edit must pass
`node scripts/validate-movements.mjs`.

## Reference files

- `references/engine-spec.md` — algorithm, thresholds, simulation gates (Brief 2)
- `references/gamification.md` — points, skills, forbidden mechanics
- `references/movement-schema.md` — movement data shape and integrity rules
