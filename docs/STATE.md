# Where the build stands — 2026-09-01 (post ADR-0008/0009)

Read `CLAUDE.md` first, then this. The engine remediation and the core
app-flow remediation from ADR-0007 are implemented in the current working
tree. The numbers below were produced after those changes.

## Verified green

```
node scripts/validate-movements.mjs  OK — 60 movements, ladders complete,
                                     constrained tiers 1-4 intact
pnpm release:check                   pass — FITHER 1.0.0 (1), iOS identity,
                                     isolated EAS build environments
engine + app typecheck               pass
engine tests                         63/63
app tests                            175/175
simulation (seed 20260831, 500 users, 26 weeks, 36755 sessions)
  G1 PASS  84/84 4x-week users at push tier >=4 by week 12, median week 8
  G2 PASS  0 tier regressions; low-capability difficult blocks 752/28303
  G3 PASS  0 sessions over budget (utilization 90.0-100.0%)
  G4 PASS  max pattern absence 3 training days (limit 7)
  G5 PASS  full-ladder exhaustion medians week 22-23 (floor: 18);
           erratic never exhausts within 26 weeks
```

The engine carries an explicit Vitest config, so a checkout nested inside
another Vite project cannot inherit its parent's plugins. App Jest runs with
`--no-watchman`, keeping the same command reliable in restricted build hosts
that cannot write Watchman's LaunchAgent.

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

**Phase 2.5 — onboarding, monetization, Gate 3 instrumentation**

- Three-screen onboarding (one decision per screen), persisted once-only,
  slotted after the resume decision.
- Billing behind a typed port with a dev-only implementation; trial from
  first completed session (7 full days); expired trial gates only new
  generation; paywall renders honest expired-state copy and
  distinguishes nothing-to-restore from restore failure.
- Crash-safe active-session persistence with same-day resume /
  finish-early.
- Time-to-first-movement instrumentation (first mount → first work
  phase), dev readout via long-press on the prompt's day label, and a
  dev-only full first-run reset (storage-level, two-tap confirm) so
  Gate 3 testers share one phone. Protocol: docs/gate-3-protocol.md.

**Production foundation — source-controlled portion**

- iOS-only app identity set to FITHER 1.0.0, native build 1, with the stable
  `com.fither.app` bundle identifier pending owner confirmation in Apple.
- EAS simulator-development, device-development, internal-preview, and
  production profiles; named environment isolation and remotely managed,
  auto-incrementing production build numbers (ADR-0010).
- SDK-matched Expo development client, plus a release-configuration validator
  enforced by the local commit hook and CI.
- Account handoff and commands documented in `docs/release-builds.md`. The EAS
  project link, Apple signing, approved identity assets, and first cloud build
  require the owner's accounts and remain open.

## Next, in order

1. **GATE 2 — owner's physical test.** `pnpm install && pnpm ios` from a
   normal checkout, then a real 10-minute workout. Still never launched
   on an iOS simulator in the build environment.
2. **GATE 3 — ready to run** (docs/gate-3-protocol.md): five real
   users, under 60 seconds to first movement. The app measures
   time-to-first-movement on device (first screen mount → first work
   phase; dev readout via long-press on the prompt's day label), a
   dev-only full first-run reset lets testers share one phone, and the
   expired-trial paywall + restore-empty copy are wired. Needs only
   the five women.
3. **Exercise instruction media** — after Gate 2 confirms pacing.
   Authored Rive/3D clips, reduced-motion fallbacks, never a network
   fetch on the workout path.
4. **Connect the build accounts** — owner confirms Apple enrollment and bundle
   ID, links the EAS project, and produces the first signed preview build using
   `docs/release-builds.md`.
5. Then RevenueCat, share card, ops SDKs (with the offline-lockout re-review),
   and store preparation per `docs/build-system.md`.

Recently closed: ADR-0009 onboarding + dev-mode monetization (three
onboarding screens; billing behind a typed port with a dev-only
implementation; trial stamps at first completed session, 7 full free
days; expired trial gates only new-session generation; paywall is the
drafted honest letter). Remaining open flags for copy/product:
"Just me and the floor" maps to none+wall (confirm); persistent avoid
areas merge silently into the daily prompt (pre-locked display is a
design decision); restore and the dev controls live on the paywall and
dev readout until a settings screen exists. Resolved since: expired-
state paywall copy, nothing-to-restore message, dev-billing hydration-
failure hang. Also closed: ADR-0008 ladder pacing (time floors 7/14/28/42/56 days;
exhaustion moved from week 8-12 to 22-23, first unlock week 8, G5
ceiling gate added) and points parity (20/25/30 by length, base 15 + 5
per ten minutes; tenMin users now earn 74% of consistent4 at equal
session count, was 45%). Erratic users' first unlock is median week 10
(p90 12) — watch in real data; flagged in docs/sim-analysis.md.

## Deferred, recorded

- `cleanStreak`/`struggledStreak` → `cleanCount`/`struggleCount` as one
  coordinated engine/app migration (S2).
- Wrist-neutral push variants; chronic sore wrists currently remove push
  work (S6; movement-author plus coach review).
- Human coach review of `data/movements.json`.
- Share card and ops SDKs. Re-run the offline-lockout review before any
  network SDK ships.
- Brief 2 still overrides the working engine defaults when it arrives.
