# Where the build stands — end of day 1 (2026-08-31)

Read `CLAUDE.md` first, then this. Everything below is verified, not
assumed: the branch is clean and every gate is green at head.

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

**Phase 0 — foundation**
- `CLAUDE.md`; three skills (fither-domain, fither-code, fither-voice)
  plus the design-system reference that encodes the premium/calm bar as
  tokens and rules.
- Five agents with disjoint surfaces: movement-author, engine-engineer,
  ui-engineer, copy-writer, reviewer.
- Machine gates: movements validator (integrity + forbidden language),
  PostToolUse hook running it on every edit, versioned git hooks
  (pre-commit tests/sim; commit-msg rejecting AI attribution), and CI
  mirroring all of it with the sim's gate numbers in the job summary.
- ADRs 0001–0007 record every decision made and why.

**Phase 1 — the thesis, validated**
- 60-movement library: five patterns, unbroken tier 1–6 ladders, all
  silent, constrained (quiet + no-gear) sessions available at tiers 1–4.
- Engine: session generation (constraint filter, staleness-driven
  coverage, tier prescription, energy adaptation, hard time budget),
  progression state machine, typed adaptations, append-only ledger.
  Pure: zero runtime deps, no clock, no Math.random.
- 500-user / 26-week simulation harness. **GATE 1 PASSED.**

**Phase 2 — partial**
- Expo app: daily prompt (one decision per screen), session player
  driven by a pure tested state machine, finish and unlock screens,
  zustand + AsyncStorage stores, all strings typed and voice-polished.
  Never launched on a simulator (none in this environment) — verified by
  typecheck and 60 tests only.
- First adversarial review: `docs/review/2026-08-31.md`.
- `docs/feature-set.md` — shareable feature list with build status.

## Left to do, in order

1. **Engine fix pack** — ADR-0007 items: taste blocks progression- and
   points-neutral (G1); fallback-tier blocks neutral (G4); unlocks once
   per lifetime (G5); empty sessions never enter history (G2 engine
   half); `Session.adaptations` required; honest `lowEnergy` (S7);
   low-capability sim persona so G2 discriminates (S4); spec Contract
   signature (S8).
   *Started and stopped mid-refactor. The partial work is preserved on
   branch `wip/engine-fix-pack` — it is RED (typecheck fails, 20 tests
   fail) and must not be merged as-is. Cheapest path is to re-run the
   pack from this clean head and discard that branch.*
2. **UI fix pack** — **B1 (blocker)**: hydration gating; a cold start
   with slow or failed storage can generate and save a session against
   the initial tier-1 profile and overwrite a real user's tiers and
   history. Then **B2 (blocker)**: render the adaptation line in a
   session-preview step; plus can't-build-a-session state (G2 app half),
   saveFailed retry (G3), rest-screen controls (S5), crash-safe session
   persistence (S3), honest fixtures (S1). *Not started.*
3. **Copy pack** — onboarding, paywall, notifications, adaptation lines,
   App Store listing, review-response templates. Must be written to
   `docs/copy/draft-strings.md` (keyed) while the ui-engineer owns
   `app/src/copy/strings.ts`, then wired in. *Not started.*
4. **GATE 2 — yours, not an agent's.** Pull the branch, `pnpm install &&
   pnpm ios`, and do a real 10-minute workout. Not a walkthrough —
   train. If Metro fights pnpm, add `node-linker=hoisted` to a root
   `.npmrc`.
5. Then Phase 3 (Rive, audio, gamification, onboarding) and Phase 4
   (paywall, ops accounts, store), per `docs/build-system.md`.

## Deferred, recorded so it is not forgotten

- `cleanStreak`/`struggledStreak` → `cleanCount`/`struggleCount`
  (coordinated engine+app rename, S2).
- Wrist-neutral push variants — chronic sore wrists currently means no
  push work at all (S6; movement-author with coach input).
- Share card (owed by gamification.md).
- Ops SDKs (Sentry, PostHog, Resend, Canny) — and re-run the
  offline-lockout review the day any of them lands.
- Human coach review of `data/movements.json`; six specific safety
  questions are in that file's commit message.
- The nine briefs are still absent. `engine-spec.md` holds working
  defaults ratified by the simulation; Brief 2 overrides them when it
  arrives, and Brief 1 may revise patterns or the schema.

## Parallel-agent notes (what worked)

Agents run concurrently only on disjoint write surfaces:
`packages/engine/**`, `app/**`, `data/movements.json`, `docs/**`,
`.github/**`. Read anything, write only your own. When two agents would
need the same file (copy-writer vs ui-engineer on `strings.ts`), the
second writes a keyed draft under `docs/` and wiring becomes mechanical.
Commits land at agent boundaries, never mid-write.
