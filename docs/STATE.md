# Where the build stands — 2026-09-14 (phase 6: submitted for App Store review)

Read `CLAUDE.md` first, then this. Everything below is on `main` with
green GitHub CI verified per wave commit (runs #90 onward).

## Verified green

```
node scripts/validate-movements.mjs  OK — 64 movements, ladders complete,
                                     constrained tiers 1-4 intact
pnpm release:check                   pass — FITHER 1.0.0 (4), com.fitherfitness.app,
                                     isolated build environments
engine + app typecheck               pass
engine tests                         181/181 (12 files)
app tests                            1048/1048 (112 suites, 0 act() warnings)
pnpm production:check                pass — production keys present by shape,
                                     fither.pro routes 200 with no redirect
pnpm bundle:ios                      pass — full production Hermes bundle
                                     exports (6.9MB Hermes; +0.6MB PostHog, +1.9MB Sentry), zero resolution errors
expo prebuild --platform ios         pass — native project generates with
                                     splash storyboard, icon assets, and
                                     the notification/store-review pods
                                     autolinked (compile itself needs macOS)
simulation (seed 20260831, 500 users, 26 weeks, 36767 sessions) —
  last run at e619761, the only engine change of phase 3 (nextMilestone,
  a pure addition); every phase-3 wave since touched the app only
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

**Phase 6 — on TestFlight (2026-09-08 → 2026-09-14)**

- **Submitted for App Store review 2026-09-14 16:20** with build
  1.0.0 (5), the FITHER Pro subscription group (yearly with the 7-day
  intro offer, monthly) and the lifetime purchase, review notes from
  docs/store/listing.md §8. Builds 3 and 4 never reached TestFlight
  (Xcode's account session had expired and the ship script did not
  notice; fixed the same day). Build (2) uploaded via `pnpm ship`
  (scripts/ship-testflight.sh: bump, prebuild, archive, verify the
  archived bundle carries the `appl_` RevenueCat key, upload, commit the
  bump). Build (1) was rejected under 2.1(a): the gate after the free
  session with no store products; App Store Connect products exist now
  and the beta review notes are docs/store/listing.md §8.
- Production config live: RevenueCat products and offering, PostHog key,
  Sentry DSN, Formspree feedback endpoint, `fither.pro` on Vercel (apex
  serves, www redirects; the six shared scenario pages pre-rendered so
  crawlers and the preflight see real content). Voice audio generated
  and committed (ElevenLabs), the voice ask on the way into the first
  session, in-set cues spoken per set, the last five seconds counted.
- Session player: the hand-offs run themselves — 15 s intro, 5 s side
  switch, rest counts out into the next set; the skip is two taps in
  place with a toast, no dialog; a stopped voice actually stops (iOS
  `remove()` never paused; now pause then remove, and a cue asked for
  before a skip cannot start after it).
- Preview rebuilt (two-line headline, one paragraph in her terms, the
  plan). Progress: one streak line, no rest-day tile. Finish: points
  beside the label. Copy cut on the paywall, Where I train and Your
  notes; an empty notes page offers the day (same door as Home).
- Analytics: hashed identity on Sign in with Apple, person properties,
  one event per place she can leave (ADR-0027).
- Haptics behind a port (ADR-0030): a choice felt, work beginning felt,
  a skip landing felt, the receipt and a grant felt; switching the voice
  on answers in the voice.
- The ladder page (owner pick 2026-09-14, design A2, mockup
  docs/design/mockups/ladder-a2.html): every pattern row and the
  next-skill row on Progress is a door to `/ladder?pattern=`, the six
  rungs from the engine's own lookup, hers marked Now, milestones marked
  Skill, the distance to the next skill when it is on that ladder;
  `ladder_view` reports which ladders get opened.
- Gates: jest `testTimeout` 20 s (a cold module graph beside an Xcode
  archive outran 5 s on the owner's Mac and failed a green test).

**Phase 0 — foundation**

- `CLAUDE.md`; domain, code, and voice skills; premium/calm design-system
  tokens and rules; Norman's six principles as a per-screen checklist.
- Machine gates: movement integrity and forbidden-language validation,
  versioned git hooks, CI (with production-bundle export), deterministic
  simulation, ADRs 0001–0012.

**Phase 1 — engine**

- 64-movement library, five complete tier 1–6 ladders; four wrist-neutral
  push variants (tiers 1 to 3, 2026-09-07) so sore wrists no longer remove
  all push work.
- Pure on-device engine: generation, per-pattern progression with time
  floors (ADR-0008), typed adaptations, history, once-per-lifetime
  unlocks, append-only points (20/25/30 by length, +5 new-tier block,
  +25 unlock). Skip is progression-neutral (ADR-0012); struggled alone
  drives easing/regression; absence never regresses. Counters are
  `cleanCount`/`struggleCount`. A day streak (ADR-0018) is a pure fold
  over history: consecutive trained days, one rest day forgiven per run,
  best run kept; `unblockingAreas` names which single avoided area, set
  aside for today, lets a session build.
- `MAX_TIER` exported so UI never bakes the ladder length into copy.

**Phase 5 — growth waves (docs/implementation-checklist.md; branch `claude/fither-build-system-09zurs`, screens merge to main only after the owner approves each)**

- Wave 1 on main: guest by default, promise on the equipment screen,
  restrictions once, preview from engine facts, funnel events
  (ADR-0024). Wave 5 on main: free-sessions experiment (ADR-0025),
  off by default.
- On the branch: intention store, week view, receipts, weekly reminder
  bodies, scenario_entry, the static recipient page (web/), the
  measurement, pilot, treatments, calibration and demo-brief documents.
- Awaiting owner approval: Home week tile, finish receipt, intention
  ask, weekly recap, Where I train, floor-distance work phase.

**Phase 4 — the redesign, built and merged to main 2026-09-07**

- ADR-0017 built screen by screen against 50+ owner-approved mockups
  (`docs/design/mockups`, rendered by `render.sh`). Dark green/black/white,
  Manrope, tab icons, shared back header, grouped lists in Progress and
  Settings with six subpages, the care moment as its own beat, the
  unlock in two beats (moment, then the white share card).
- Day streak (ADR-0018): engine `computeStreak`; hub line, finish pill,
  Progress, the daily invitation's body (rescheduled after every commit
  and on every foreground); `workout_complete.streak` in analytics.
- The no-session outcome recommends the way out: engine
  `unblockingAreas`, one tappable "Set aside X today" row each.
- Figures move (ADR-0019): two generated keyframes per movement, a
  crossfade loop where the figure is the hero, still under Reduce Motion.
- Feedback (ADR-0020): Settings → Send feedback, port + offline queue,
  endpoint set by `EXPO_PUBLIC_FEEDBACK_URL` (docs/feedback-setup.md).
- Coverage audit (`pnpm --filter @fither/engine coverage`,
  docs/engine-decision-tree.md): 331,776 prompts; never over budget,
  never a constraint violation, empty only at 3+ avoided areas (44 sets)
  and always unblockable; two owner findings (underfill with 2+ areas at
  20/30 minutes, repeated movements in long sessions) recorded there.
- ADR-0023: "Hard today" counts. A struggled block is an attempted block:
  the finish closes as a session with its figures, the day counts for the
  hub and the streak; points and progression unchanged.
- ADR-0021: the cap grows as patterns fall away (one pattern can carry
  30 minutes) and the picker takes a fresh movement down the ladder
  before repeating; whole space now fills to 90%, sim gates unchanged.
- Tests: app 80 suites / 653 tests, engine 127; typecheck clean.

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
  where the questions would be, Progress/Settings doors intact. The
  paywall is the honest letter cut to what she needs (2026-09-14: no
  letterhead, no lead, no record note; headline, ladder, benefits,
  plans, price, legal).
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
- Onboarding: the welcome opens on the drawn mark (the pose-1 figure,
  bundled as one white asset the app tints to the accent — generated by
  the brand script next to the icon set), in three beats with Begin
  tappable throughout; the two questions count themselves; the equipment
  options each show the figure of a tier-one movement she can do with
  exactly that equipment (ids pinned to the library by a test). The
  staggered answer row is one primitive shared with the daily prompt.
- In the session: the progress line fills as a movement (left-anchored
  scale on the native driver) instead of jumping; the rest and
  side-switch phases enter as one breath and keep the movement's figure;
  the feedback rows enter staggered. The countdown numeral deliberately
  does not animate per tick. The work phase is unchanged: the session
  is sacred.
- The finish lands in three beats — the figures of the blocks she
  completed (read off the player's own outcomes; nothing-done draws
  none), the honest headline, then the points rising in once (never
  counting up). Continue sits outside the choreography. The reminder
  ask's rationale and its three hours enter the same way; it carries no
  flow indicator on purpose, since its second step exists only after
  the OS grants.

**Phase 3, wave by wave (2026-09-04, each deployed to main separately)**

| Wave | Commit | Scope |
|---|---|---|
| Hub | `105ed42` | `/(tabs)` Home / Progress / Settings; prompt moves to `/prompt`; unlock choreography |
| Home | `e619761` | Next skill from the engine's `nextMilestone` (the one engine change) |
| Gate fix | `3c62dc9` | Red CI from a test-file type error; pre-commit now typechecks first |
| Progress + Settings | `31ecf4a` | Shared Card, animated ladders, figures on skills, grouped option rows |
| Prompt | `857a488` | Four-segment flow indicator, staggered rows, shared Track |
| Onboarding | `3bb68cd` | The drawn mark on the welcome; figures on the equipment options |
| Session | `0d818a0` | Progress line fills as motion; rest and side switch keep the face |
| Finish | `f23c50e` | Three beats; figures of completed blocks; reminder ask |
| Test hygiene | `4fac363` | 54 act() warnings → 0; the hook unit-tested |
| Copy nits | `7f53e97` | "+1 point"; the hard-denied notification line |
| Docs | `c158600` | STATE, feature-set, code skill, brand README |
| Share export | `343bd76` | The unlock card captured and shared as a PNG; text share as fallback (adds react-native-view-shot + expo-sharing: owner rebuild) |
| Voice | `01b9711` | Generator + offline playback + Settings card + the quiet-day rule; audio files pending the owner's voice (adds expo-audio: owner rebuild) |
| Review fixes 1–3 | `f06ecb0` `038e74e` `c4fbb24` | Two blockers; motion/a11y; the finish. Waves 4–7 of the reviewer's should-fixes are still open (recorded in AUDIT.md) |
| Audit | `a7f7df4` | AUDIT.md — phase 1 of the audit-and-ship brief |
| Pricing + store | `6a3a11c` `db810ff` | ADR-0014: $59.99/$12.99/$99 lifetime; RevenueCat adapter behind the port, Customer Center, the day-3 lifetime offer; the store trial is the trial; owner's key via env (three native deps: owner rebuild) |
| Sign in with Apple | `b8c74a6` `2a5fad5` | Real adapter behind the auth port; Google hidden until it has one; revocation checked at launch |
| Review fixes 4–7 | `4ed45e3` `7df0139` `fac5a9e` `5302b37` | Hub/nav; voice + share hardening, 640px figures; the rail token + contrast test; the weaker tests |
| Splits | `c8e6bd3` | The three over-400-line screens split (dev tools card, prompt outcomes, player phases); the prompt reuses the shared hydration set |
| Analytics | `4f8807e` | ADR-0015: the analytics port; PostHog behind it when its key is set; the four events (deep_link_open, workout_start, workout_complete, trial_start), anonymous, forbidden-list-scanned (adds posthog-react-native, pure JS: no rebuild) |
| Account | `061a71c` | Settings account card: how she is continuing, sign out, erase everything on this phone (App Review 5.1.1(v)). One shared persisted-store list; the dev reset now also clears reminders, the lifetime ask and the rating bookkeeping it had missed |
| Hygiene | `4188787` | AUDIT.md cuts 2–3: the dead points label; onboarding's equipment aliases |
| Listing | `713e7c7` | docs/store/listing.md — the App Store copy, paste-ready with measured counts |
| Crash reporting | — | ADR-0016: the monitoring port; Sentry behind it when its DSN is set; crash/error only, no PII, beforeSend scrub; failed saves reported; dev test-crash buttons; Metro wrapped for debug ids (adds @sentry/react-native, a native module: owner rebuild) |

**Reviews**

- Two adversarial pre-merge reviews (waves 1–2), an engine-change
  review with independent sim re-runs, and the end-to-end Norman audit
  (docs/review/2026-09-02-exercise-experience-audit.md tracks the
  earlier Codex audit; the Norman audit's 3 blockers and 10 should-fixes
  are all closed, its polish list shipped).
- The phase-3 reviewer pass (three fresh-context reviewers, 2026-09-05)
  found two blockers and nineteen should-fixes; all are closed in
  review-fix waves 1–7. Its notes that were product decisions are in
  AUDIT.md and the DECIDE list below.

## Next, in order

1. **Wait for App Review** (up to 48 h). On approval: release, then flip
   the landing page from "Coming to the App Store" to the store link
   (`web/src/content.mjs` holds the one App Store URL; the "Coming" line
   is what the production preflight forbids on the shared pages).
   On rejection: read the reason against docs/store/listing.md §8 before
   changing anything.
2. **Owner: walk build 5 on the phone** while review runs: skip mid-cue
   (no overlap, a thump, the toast), Progress → a ladder, Voice → Spoken
   speaks a cue, sandbox yearly purchase unlocks with the success thump,
   Settings footer reads 1.0.0 (5).
3. **Backend (ADR-0022, decided 2026-09-07): Supabase, first update.**
   Not before launch. Order: schema and RLS, auth adapter and account
   deletion, append-only sync behind the ports, feedback onto the same
   project, owner dashboard. The engine never moves server-side.

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
- Dark-mode danger token (#A65746 on #171614 = 3.5:1) is below AA —
  unused as text today; the first dark screen to render danger text
  needs a dark value (a11y-wave flag).
- Erratic users' first unlock is median week 10 (p90 12) — watch in
  real data (docs/sim-analysis.md).
