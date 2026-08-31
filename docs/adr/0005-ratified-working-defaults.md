# ADR-0005: Ratified working defaults

- Status: accepted
- Date: 2026-08-31

## Context

The feature-set compilation pass cross-checked every truth file against
the code being built and found working defaults that were already load-
bearing in shipped data/code but still marked PROPOSED, plus one naming
drift between spec and contract. Ratified here so the files agree.

## Decision

1. **State library: zustand** (already the app's store layer).
2. **Body areas**: shoulders, wrists, elbows, back, hips, knees, ankles,
   core — encoded in all 60 movements and the engine types; changing the
   list is now a schema change under movement-schema.md's change protocol.
3. **Skill milestone tiers: 4 and 6** per pattern (capability milestone
   and mastery). Two unlocks per pattern, ten total.
4. **Prompt contract naming**: the field is `date` (ISO yyyy-mm-dd), and
   `equipment` (user's available equipment) is part of the daily prompt
   inputs; engine-spec.md updated to match `types.ts`.

## Consequences

PROPOSED markers removed from fither-code (state) and movement-schema
(body areas); gamification.md now states the milestone tiers. Remaining
PROPOSED items are the engine's prescription tuning constants (rests,
sets, transition seconds, taste block) — the engine session firms those
up against the simulation and they get written back to engine-spec.md
when Gate 1 passes.
