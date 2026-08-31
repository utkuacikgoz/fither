# Where the build stands — 2026-09-01

Read `CLAUDE.md` first, then this. The engine remediation and the core
app-flow remediation from ADR-0007 are implemented in the current working
tree. The numbers below were produced after those changes.

## Verified green

```
node scripts/validate-movements.mjs  OK — 60 movements, ladders complete,
                                     constrained tiers 1-4 intact
engine typecheck                     pass
app typecheck                        pass
engine tests                         50/50
app tests                            68/68
simulation (seed 20260831, 500 users, 26 weeks, 36785 sessions)
  G1 PASS  84/84 4x-week users at push tier >=4 by week 12, median week 3
  G2 PASS  0 tier regressions across both 2x-week personas
           low-capability difficult blocks: 1460/27465
  G3 PASS  0 sessions over budget (utilization 90.0-100.0%)
  G4 PASS  max pattern absence 3 training days (limit 7)
```

The clone lives inside another Vite project, so Vitest was run with an
isolated temporary config to prevent the parent project's Cloudflare config
from leaking in. App Jest was run with `--no-watchman` because the sandbox
cannot write Watchman's LaunchAgent. These are host constraints, not repo
failures.

## Done

**Phase 0 — foundation**

- `CLAUDE.md`; domain, code, and voice skills; premium/calm design-system
  tokens and rules.
- Machine gates: movement integrity and forbidden-language validation,
  versioned git hooks, CI, deterministic simulation, ADRs 0001–0007.

**Phase 1 — engine and remediation**

- 60-movement library with five complete tier 1–6 ladders.
- Pure on-device engine for generation, progression, typed adaptations,
  history, unlocks, and append-only points.
- Taste and fallback blocks are progression-neutral. Taste blocks cannot
  earn new-tier points.
- Skill milestones unlock once per pattern/tier for the user's lifetime.
- Empty generation is a no-op and never enters history.
- `Session.adaptations` is required; `lowEnergy` is emitted only when energy
  actually changes the prescription.
- The simulation now includes a lower-capability, slower-gain 2x/week
  persona, so Gate 2 exercises real difficulty rather than only happy paths.

**Phase 2 — core app flow and safety**

- Four-question daily prompt, one decision at a time.
- Profile, ledger, and settings hydration gate both session generation and
  completion; a cold start cannot apply work against placeholder state.
- A dedicated session-preview step explains the engine's adaptations before
  movement begins.
- Impossible answer combinations stay out of the player and receive an
  honest adjust-answers state.
- Focused player with explicit end-rest and skip controls.
- Finish flow retries failed saves instead of trapping the user behind copy
  that cannot act.
- Fixtures now use a real tier-4 skill milestone and completed-session
  outcomes.
- First adversarial review remains at `docs/review/2026-08-31.md`.

## Next, in order

1. **Persist and resume in-progress player state (S3).** Document and test
   the remaining dual-write gap between profile/history and the ledger.
2. **Progression pacing decision (from docs/sim-analysis.md).** Every
   persona reaches tier 6 in all five patterns by week 8-12 — even
   2x/week users exhaust the ladder in ~15 sessions and then have
   nothing to unlock for 14+ weeks, because 20/30-minute sessions cover
   all five patterns and advancement needs 3 clean SESSIONS per tier.
   Structural, not a harness artifact. Take it to the coach with the
   packet; candidate levers: clean-session counts that rise with tier,
   or advancement counted per pattern less often than every session.
   Also decide: 10-minute-only users earn half the points of 30-minute
   users at identical consistency (1410 vs 3125 at week 26) — is
   points-per-minute the right price for equal showing-up?
3. **GATE 2 — owner's physical test.** Run `pnpm install && pnpm ios` from a
   normal checkout and do a real 10-minute workout. This has still not been
   launched on an iOS simulator in the build environment.
4. **Copy/onboarding/paywall pack.** Write the remaining keyed copy, build
   onboarding, then add the decided £5.99 monthly / £39.99 annual paywall
   without compromising offline workouts.
5. **Exercise instruction media.** Add the motion layer only after the real
   workout test confirms player pacing. Prefer authored Rive/3D clips with
   cue pointers and reduced-motion fallbacks; never block the workout on a
   network fetch.
6. Then gamification/share card, distribution instrumentation, and store
   preparation per `docs/build-system.md`.

## Deferred, recorded

- `cleanStreak`/`struggledStreak` → `cleanCount`/`struggleCount` as one
  coordinated engine/app migration (S2).
- Wrist-neutral push variants; chronic sore wrists currently remove push
  work (S6; movement-author plus coach review).
- Human coach review of `data/movements.json`.
- Share card and ops SDKs. Re-run the offline-lockout review before any
  network SDK ships.
- Brief 2 still overrides the working engine defaults when it arrives.
