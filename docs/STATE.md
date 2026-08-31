# Where the build stands — 2026-08-31

Read `CLAUDE.md` first, then this. Everything below is verified, not
assumed: the tree is clean and every gate is green at `b470921`.

## Verified green at head

```
node scripts/validate-movements.mjs  OK — 60 movements, ladders complete,
                                     constrained tiers 1-4 intact
pnpm typecheck                       engine + app: Done
pnpm test                            engine 45/45, app 60/60
pnpm sim   (seed 20260831, 500 users, 26 weeks, 38988 sessions)
  G1 PASS  100/100 4x-week users at push tier >=4 by week 12, median week 3
  G2 PASS  0 tier regressions for 2x-week users
  G3 PASS  0 sessions over budget (utilization 90.0-100.0%)
  G4 PASS  max pattern absence 4 training days (limit 7)
```

## Done

- **Phase 0**: CLAUDE.md, three skills (domain/code/voice) + design
  system reference, five agents, machine gates (movements validator with
  a forbidden-language check, PostToolUse hook, versioned git hooks
  incl. no-AI-attribution commit-msg), ADRs 0001–0007.
- **Phase 1**: 60-movement library; engine (generation, progression,
  adaptations) + 500-user sim. **Gate 1 passed.**
- **Phase 2 (partial)**: Expo app — daily prompt, session player, finish,
  unlock; zustand + AsyncStorage stores; all strings typed and voice-
  polished. Never launched on a simulator (none in the build env);
  verification is typecheck + tests.
- First adversarial review filed: `docs/review/2026-08-31.md`.

## Next, in order

1. **Engine fix pack** (assigned engine-engineer, ADR-0007): taste blocks
   progression/points-neutral (G1); fallback-tier blocks neutral (G4);
   unlocks once per lifetime (G5); empty sessions never enter history
   (G2 engine half); `Session.adaptations` required (fixture already
   carries `[]`); honest `lowEnergy` (S7); low-capability sim persona so
   G2 discriminates (S4); spec Contract signature (S8).
   *This agent was stopped before writing any code — start it fresh.*
2. **UI fix pack** (ui-engineer): hydration gating (B1 — the blocker; a
   cold-start race can overwrite a real profile), render the adaptation
   line (B2), can't-build-a-session state (G2 app half), saveFailed
   retry (G3), rest-screen controls (S5), honest fixtures (S1), persist
   player state for crash recovery (S3).
3. **GATE 2 — the owner's, not an agent's**: pull the branch, `pnpm
   install && pnpm ios`, and actually do a real 10-minute workout. If
   Metro fights pnpm, add `node-linker=hoisted` to a root `.npmrc`.
4. Then Phase 3 (Rive/audio/gamification/onboarding), Phase 4 (paywall,
   ops accounts, store), per `docs/build-system.md`.

## Deferred (recorded, not forgotten)

- `cleanStreak`/`struggledStreak` → `cleanCount`/`struggleCount`
  (coordinated engine+app rename, S2).
- Wrist-neutral push variants: chronic sore wrists currently means no
  push work at all (S6, movement-author + coach).
- Share card (owed by gamification.md); ops SDKs (Sentry/PostHog/Resend/
  Canny) — re-run the offline-lockout review the day any of them lands.
- Human coach review of `data/movements.json` (six safety questions are
  in the library commit message).
- The nine briefs are still absent; engine-spec.md holds working defaults
  ratified by the sim, and Brief 2 overrides them when it arrives.
