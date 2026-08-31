# ADR-0007: First review — decisions and remediation plan

- Status: accepted
- Date: 2026-08-31

## Context

The first full adversarial review (docs/review/2026-08-31.md) found 2
blockers, 6 bugs, 9 smells — all in behavior the automated gates don't
measure. These decisions resolve its adjudications and assign fixes.

## Decisions

1. **`Session.adaptations` is required.** Fixture updated; engine
   tightens the type.
2. **Quiet is a designed data gap.** The v1 library is intentionally
   all-silent; the prompt question stays (ADR-0003) with exclusion-based
   honesty semantics. Loud tier-5/6 variants may be added later on
   training merit only — never to make an adaptation line fire.
3. **Taste blocks are fully progression- and points-neutral**: no
   `atNewTier` flag, no +5.
4. **Fallback-tier blocks (below current tier, prescribed under
   constraints) are progression-neutral** — they neither advance nor
   regress the pattern, mirroring taste blocks above the tier.
5. **Skill unlocks fire once per (pattern, milestone) lifetime.**
   Profile carries unlock memory (additive contract change). Skills are
   never lost, therefore never re-earned.
6. **Zero-block generation is a first-class outcome**: the engine
   appends no empty history entries; the app shows "couldn't build a
   session around today's answers" — never "Session complete".
7. **`STALE_FOCUS_MIN_TRAINING_DAYS = 3` ratified** (unit: training
   sessions).
8. **Forbidden-language validator gate** added to
   scripts/validate-movements.mjs and movement-schema.md rule 7;
   `bodyweight-squat` renamed `air-squat`.
9. **`cleanStreak`/`struggledStreak` → `cleanCount`/`struggleCount`**:
   accepted, scheduled as one coordinated engine+app rename (S2), not
   mixed into the functional fix wave.
10. **Hydration gating (B1), adaptation surface (B2), saveFailed retry
    (G3), rest-screen controls (S5), honest fixtures (S1), lowEnergy
    honesty edge (S7), spec contract line (S8), sim persona (S4)**:
    accepted as specified in the review.

## Remediation assignment

- movement-author: G6 rename (air-squat).
- engine-engineer: G1, G2 (engine half), G4, G5, S4, S7, S8, required
  adaptations.
- ui-engineer: B1, B2, G2 (app half), G3, S1, S3 (persist player
  session for crash recovery; document the dual-write gap), S5, S9.
- Deferred post-Gate-2: S2 rename, S6 wrist-neutral push variants
  (movement-author with coach input).

## Consequences

The share card (gamification.md) and the ops integrations remain owed;
the offline-lockout review must re-run the day any network SDK lands.
