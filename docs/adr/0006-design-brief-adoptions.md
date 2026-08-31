# ADR-0006: Design brief review — adoptions and rejections

- Status: accepted
- Date: 2026-08-31

## Context

The owner supplied an external design brief (docs/design/design-brief-
external.md, received truncated after principle 6) and asked for the
useful parts to be implemented. Reviewed against the truth files.

## Adopted

1. **Taglines**: "Strength that fits your life" (brand), "A workout that
   fits today" (product/daily) → fither-domain, fither-voice.
2. **Show the adaptation**: the engine explains today's session in one
   plain line; UI renders it verbatim → engine-spec (typed `adaptations`
   on Session, first post-Gate-1 additive change), design-system.
3. **One decision at a time**: daily prompt and onboarding are one
   question per screen, auto-advance → design-system.
4. **Ten minutes is complete**: short sessions are never framed or styled
   as lesser → fither-voice, design-system.
5. **Audience contexts**: office/travel; frequent travelers secondary;
   postpartum future-only, gated on specialist review → fither-domain.
6. **Positioning not-list** (not weight-loss/calorie/bodybuilding/random
   generator/AI-invented exercises/social feed) → fither-domain.
7. **Emotional register**: understood, capable, calm, in control, proud
   after ten minutes → fither-voice.

This ADR also ratifies the engine's sim-validated prescription constants
(engine-spec "Prescription constants" section).

## Rejected / deferred

- **"Reward weekly momentum"** — a streak in different clothes; streaks
  are forbidden-forever (gamification.md). Points + skill unlocks already
  reward showing up without loss-framing. Any momentum mechanic needs a
  new ADR passing the no-guilt test.
- **"FITher" capitalization** — brand styling belongs to the Brief 6
  identity work; the repo keeps FITHER until that decides otherwise.
- **Principle 6+ ("Coaching in context") and anything after** — arrived
  truncated; review when the full document is available.

## Consequences

Copy-writer must adopt the taglines and the ten-minutes rule across all
strings. The engine's next change adds `adaptations`; the UI session
preview renders it. No mechanic may frame short sessions or missed days
as deficits.
