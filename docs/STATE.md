# Where the build stands — 2026-09-02 (post-audit, all waves shipped)

Read `CLAUDE.md` first, then this. Everything below is on `main` at
`b9f80ab` with green GitHub CI verified per wave commit.

## Verified green

```
node scripts/validate-movements.mjs  OK — 60 movements, ladders complete,
                                     constrained tiers 1-4 intact
pnpm release:check                   pass — FITHER 1.0.0 (1), iOS identity,
                                     isolated EAS build environments
engine + app typecheck               pass
engine tests                         69/69
app tests                            391/391 (35 suites)
pnpm bundle:ios                      pass — full production Hermes bundle
                                     exports (2.7MB), zero resolution errors
expo prebuild --platform ios         pass — native project generates with
                                     splash storyboard, icon assets, and
                                     the notification/store-review pods
                                     autolinked (compile itself needs macOS)
simulation (seed 20260831, 500 users, 26 weeks, 36767 sessions)
  G1 PASS  84/84 4x-week users at push tier >=4 by week 12, median week 8
  G2 PASS  0 tier regressions; low-capability difficult blocks 767/28270
  G3 PASS  0 sessions over budget (utilization 90.0-100.0%)
  G4 PASS  max pattern absence 3 training days (limit 7)
  G5 PASS  full-ladder exhaustion medians week 22-23 (floor: 18);
           erratic exhausts week 26 (info only)
```

Skip-neutrality (ADR-0012) moved the sim measurably vs the pre-0012
baseline (36755 sessions, difficult blocks 752/28303, erratic=never):
+12 sessions, 767/28270 difficult, erratic's full-ladder exhaustion
arrives week 26 instead of never. Every gate passes on both sides;
recorded per the report-actual-numbers rule.

The engine carries an explicit Vitest config, so a checkout nested inside
another Vite project cannot inherit its parent's plugins. App Jest runs with
`--no-watchman`, keeping the same command reliable in restricted build hosts
that cannot write Watchman's LaunchAgent.

## Done

**Phase 0 — foundation**

- `CLAUDE.md`; domain, code, and voice skills; premium/calm design-system
  tokens and rules; Norman's six principles as a per-screen checklist.
- Machine gates: movement integrity and forbidden-language validation,
  versioned git hooks, CI (with production-bundle export), deterministic
  simulation, ADRs 0001–0012.

**Phase 1 — engine**

- 60-movement library, five complete tier 1–6 ladders.
- Pure on-device engine: generation, per-pattern progression with time
  floors (ADR-0008), typed adaptations, history, once-per-lifetime
  unlocks, append-only points (20/25/30 by length, +5 new-tier block,
  +25 unlock). Skip is progression-neutral (ADR-0012); struggled alone
  drives easing/regression; absence never regresses. Counters are
  `cleanCount`/`struggleCount` — the word "streak" is banned from the
  codebase, enforced by a shape-guard test.
- `MAX_TIER` exported so UI never bakes the ladder length into copy.

**Phase 2 — the full app flow (all audit waves shipped)**

- Splash (expo-splash-screen — the legacy config key was silently
  ignored by SDK 57; fixed) → sign-in (Apple/Google/guest behind the
  auth port, ADR-0011; busy/pending states) → three-screen onboarding →
  four-question daily prompt (one decision at a time; outlined corner
  doors to Progress and Settings; completed-today state keyed off
  engine-written completed blocks, midnight-fresh via a foreground-
  reactive date) → honest preview with answer-editing → side-aware
  player (full cues, wall-clock countdowns, delayed no-guilt skip whose
  confirm pause is honoured, VoiceOver announcements per phase
  transition) → four honest closes (complete / ended early / out of
  time / nothing done) with the +10% active-time session ceiling
  (ADR-0012 §2 — away time never spends the budget) → sequenced unlock
  celebrations (one skill at a time, contrast-safe) with per-skill text
  share card → journaled, crash-safe, idempotent completion (a hard
  kill cannot double-award; a previous-day snapshot with completed work
  silently applies under its own date — midnight never discards work).
- Route guards on every public route: nothing cold-opens blank or
  celebrates nothing; invalid entries land calmly on home.
- Progress screen: five pattern ladders (nouns from copy, track length
  from MAX_TIER), unlocked skills, points total. (Rebuilt in phase 3.)
- Settings: persistent avoid areas, equipment (editable — no longer an
  onboarding one-shot), subscription/restore, care journal (view / edit
  / delete with v1 id migration), daily-invitation slot control, dev
  tools (Gate 3 reset + timing readout + a flow previewer that seeds
  real state for paywall/unlock/every finish state).
- Monetization: billing port + dev adapter; trial stamps ONLY on the
  engine's own completed-session evidence, journaled for replay
  (ADR-0009 §2); expired trial renders the gated day — paywall letter
  where the questions would be, Progress/Settings doors intact, "Your
  record stays yours." The paywall is the redesigned honest letter
  (triple-marked selection, purchase-failure notice, no dead controls).
- Daily invitation (ADR: owner-decided): once-ever in-context ask after
  the first completed session, slot pick (8:00/12:30/18:30 — real hours
  in the labels), seven weekly local triggers rotating four invitation
  bodies, fully offline; "No invitation" equal-dignity in Settings.
  System rating prompt from the second completed session onward, never
  colliding with the ask, never mid-session.
- Accessibility: theme-true action contrast (dark CTA 6.79:1, ratio
  table in the a11y wave report), announcements without speech spam,
  finish announces the honest close, 2× numeral scaling cap, decorative
  glyphs hidden on both platforms.

**Phase 3 — the visual language (ADR-0013)**

The owner walked the build and called it "functional and boring — no
animations, no images". The design system's austerity rules were retired
rather than defended (ADR-0013), and the app was rebuilt against the new
ones.

- A home hub with tabs: `/(tabs)` carries Home / Progress / Settings and
  the session flow stays outside it, so the tab bar never appears
  mid-workout. Home is today's card, the five ladders at a glance and
  the next skill the engine names (`nextMilestone`); the four questions
  moved to a pushed `/prompt`.
- Every movement has a face: 60 parametric line figures generated by
  `scripts/generate-movement-figures.py`, tinted to the theme's accent
  from one white asset set, on the preview list, the home skill card and
  the progress skill rows. Placeholder craft with real intent — Brief 6
  replaces the rendering, not the pose data.
- Motion everywhere inside the same 250–350ms ease-out envelope: cards
  enter staggered, tier ladders draw themselves in, and the unlock is
  choreographed in four beats. Reduce Motion lands every value at its
  final state.
- One card (`design/primitives/card.tsx`) shared by all three tabs, and
  a settings unit (`option-row.tsx`) that groups preferences inside a
  card with hairlines instead of stacking the daily prompt's bordered
  answer rows down the page. Settings choices now always carry a visible
  check — a preference she set months ago has to be readable at a
  glance, where a prompt row could rely on auto-advancing away.
- Scroll indicators shown on every scrollable surface (the owner could
  not tell the preview list scrolled); only the session player stays
  clean.
- The daily prompt gained a four-segment flow indicator (one segment per
  ADR-0003 question, counted from the question list itself, carried as
  the platform's progressbar semantics — no new copy) and staggered
  answer-row entrances. Gate 3 is untouched: no question added, no tap
  added, and every row stays hittable from its first frame, which a test
  pins.

**Reviews**

- Two adversarial pre-merge reviews (waves 1–2), an engine-change
  review with independent sim re-runs, and the end-to-end Norman audit
  (docs/review/2026-09-02-exercise-experience-audit.md tracks the
  earlier Codex audit; the Norman audit's 3 blockers and 10 should-fixes
  are all closed, its polish list shipped).

## Next, in order

1. **Owner: rebuild and walk the app.** Wave C added native modules —
   `git pull`, `rm -rf app/ios`, `cd app && npx expo run:ios`. The dev
   previewer (Settings → Developer tools) walks paywall/unlock/all four
   closes in minutes. This is the only unverified inch: everything
   checkable without a Mac is checked (bundle export + prebuild green).
2. **Owner: GATE 3** — five real users, under 60s to first movement
   (docs/gate-3-protocol.md; the protocol now names sign-in as the
   post-reset first screen).
3. **Owner: Apple Developer enrollment + EAS link**
   (docs/release-builds.md). Unblocks: real Apple/Google sign-in
   adapters, App Store Connect subscription products → RevenueCat
   adapter + sandbox testing + offline-lockout re-review, TestFlight,
   ops SDKs (Sentry/PostHog/Resend/Canny), store preparation.
4. **Owner: commission Brief 6** (movement animations; 6 reference
   clips first) and the **human coach review** of the 60 movements.
5. Build side, unblocked now (small): the two flagged copy nits below;
   share-card image export when wanted; voice audio after the owner's
   voice choice.

## Deferred, recorded

- Wrist-neutral push variants; chronic sore wrists currently remove push
  work (movement-author plus coach review).
- Brief 2 still overrides the working engine defaults when it arrives.
- One-frame gate flash before the resume-offer effect commits —
  pre-existing pattern (Norman audit: note).
- Library-absent fallback renders raw pattern ids (progress screen,
  degraded-build state only) — wants a strings.errors-shaped fallback.
- useReducedMotion resolves async, so a Reduce Motion user can catch the
  first frames of the paywall letterhead fade before the snap.
- Progress screen renders without its own hydration gate — matters only
  if a cold deep-link to /progress ever exists.
- A permanently-denied OS notification permission ends a Settings slot
  tap at the instant OS denial with no in-app line — needs a "turn it
  on in iOS Settings" copy key (wave-C flag).
- Dark-mode danger token (#A65746 on #171614 = 3.5:1) is below AA —
  unused as text today; the first dark screen to render danger text
  needs a dark value (a11y-wave flag).
- Erratic users' first unlock is median week 10 (p90 12) — watch in
  real data (docs/sim-analysis.md).
