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

Exercise-experience production work is now tracked by
`docs/review/2026-09-02-exercise-experience-audit.md`. Its first integrity
slice is implemented on `codex/exercise-integrity-wave-1`: the player carries
all movement cues, bilateral and unilateral prescriptions are distinct,
unilateral sets explicitly run left → switch → right, skip is confirmed and
truthfully named in every active phase, old active-session shapes upgrade on
restore, and the progress line exposes a screen-reader value. The preview now
shows its actual block prescription, leads with one primary adaptation, and
returns to prefilled daily answers for edits. Next is durable idempotent
completion and lifecycle-aware timers. Completion is now journaled under a
stable per-session ID before profile, history, ledger, trial, and active-session
state are changed. A retry or relaunch replays that exact result, so a hard kill
cannot award twice; the finish screen withholds success until the committed
write and active-session cleanup land. Next is elapsed-time restoration across
backgrounding and process death, followed by honest ended-early and
completed-today states.

1. ~~GATE 2~~ **PASSED 2026-09-01.** The owner ran the app from a device
   build, trained with it, and called it good after the live-testing UX
   pack (three-option feedback, quiet skip, selection cues, care moment)
   shipped in response.
2. **GATE 3 — ready to run** (docs/gate-3-protocol.md): five real
   users, under 60 seconds to first movement. The app measures
   time-to-first-movement on device (first screen mount → first work
   phase; dev readout via long-press on the prompt's day label), a
   dev-only full first-run reset lets testers share one phone, and the
   expired-trial paywall + restore-empty copy are wired. Needs only
   the five women.
3. **Build wave 1 — landing now.** Shipped: shareable skill card on the
   unlock screen (text share via the system sheet, zero new deps; image
   export is a later isolated swap) plus settings/share/auth/profile
   strings. In flight: the settings screen (restore, persistent avoid
   areas, dev tools, version) and the sign-in flow (Apple + Google +
   guest behind a typed auth port with a dev implementation, ADR-0011;
   launch → sign-in → onboarding → prompt). Each lands only with green
   gates; the adversarial reviewer passes over the whole wave before
   main moves. Norman's six principles are now a per-screen checklist
   in the design-system skill — the owner reviews against them.
4. **Build wave 2 — after wave 1 merges** (sequenced to avoid file
   collisions): the Progress screen (pattern tiers, unlocked skills,
   points; entry from the daily prompt), the paywall visual redesign
   (the honest letter, premium treatment), and copy cleanup
   (`strings.brand.wordmark`; owner to decide silent share failure vs.
   one calm fallback line).
5. **Build wave 3 — after the owner's next device test**: notification
   permission ask (in context, after the first completed session) +
   rating prompt, batched because both add native modules (one rebuild);
   the deferred cleanStreak→cleanCount rename (S2) with sim numbers;
   docs refresh.
6. **Owner-side, unblocking the rest**: test waves 1–2 clickable on
   device (Norman review); run Gate 3; Apple enrollment + EAS link per
   `docs/release-builds.md` — that unblocks signed builds, then
   RevenueCat, ops SDKs (with the offline-lockout re-review), exercise
   instruction media (Brief 6), and store preparation per
   `docs/build-system.md`.

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
- Busy/in-progress feedback on the sign-in and restore taps (Norman #5):
  instant with the dev ports; add honest pending states the day real
  Apple/Google/RevenueCat adapters land (reviewer 2026-09-02 #4).
- `strings.profile.tier` bakes "of 6" into copy; when the Progress
  screen lands, the ladder length must come from an engine export
  (reviewer #6).
- One-frame gate flash before the resume-offer effect commits —
  pre-existing pattern, sign-in inherits it (reviewer #8).
- Library-absent fallback renders raw pattern ids (progress screen,
  degraded-build state only) — wants a strings.errors-shaped fallback
  (reviewer wave-2 #4).
- useReducedMotion returns false until the async read lands, so a
  Reduce Motion user can catch the first frames of a fade (paywall
  letterhead) before the snap (wave-2 #5).
- Progress screen renders without its own hydration gate — fine as a
  pushed route today, matters if a cold deep-link to /progress ever
  exists (wave-2 #6, matches the settings-screen pattern).
