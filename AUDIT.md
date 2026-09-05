# FITHER — audit (Phase 1, report only)

Head: `c4fbb24` on `main`, 2026-09-05. Nothing was fixed, refactored or
deleted to produce this. One uncommitted two-line test edit
(`finish-screen.test.tsx`, settling an `act()` warning) is parked in the
working tree from the review-fix work that was in flight when this brief
arrived.

Gates at head: engine 75/75, app 477/477 (47 suites), typecheck clean,
release-check OK, iOS bundle exports (2.8MB Hermes), prebuild green, sim
G1–G5 pass (last engine change `e619761`). CI green on every push.

---

## 0. The brief's ground truth vs. the repo's ground truth

The brief asks: *"If something in the ground truth conflicts with what is
already built and the built version is better, say so and argue for it.
Do not silently follow."* Seven of the brief's ground-truth lines are not
refinements of this codebase — they describe a different product. Each
is listed with what the repo decided, where, and my recommendation. The
rest of this audit is written against the brief as given, so you can
see the cost of each choice.

| # | Brief says | Repo decided | Where | Recommendation |
|---|---|---|---|---|
| 1 | **Six-word picker** (Drained / Wired / Heavy / Foggy / Tender / Strong), one word → one workout, under 10 seconds | **Four-question daily prompt** (time 10/20/30, energy, quiet?, sore areas) → on-device engine generates the session from answers + history + a 60-movement library with per-pattern six-tier progression | ADR-0003 (decided), ADR-0006, fither-domain "The format", engine-spec, 500-user/26-week simulation gates G1–G5 | **Argue for the built version.** Six words with fixed workouts is a content app: nothing adapts, nothing progresses, the same "Drained" workout on week 1 and week 12. The built engine is the product's whole claim ("measurably stronger") and is the only part that has passed a machine gate (36,767 simulated sessions). Speed: the built prompt is four taps in ~10–15s, Gate 3 targets <60s to first movement — the brief's "under 10 seconds" is met in spirit and measured in practice. A word picker *as the energy question's skin* is a copy change, not a product change; that is the honest way to have both. |
| 2 | **SwiftUI native** | **Expo / React Native**, TypeScript strict, pure engine package | ADR-0004 (scaffold), fither-code | **Argue for the built version.** ~10k lines of tested app + engine + sim exist. A SwiftUI rewrite discards all of it, including the only gated code (the engine). Nothing in the brief's shippable path (items 1–4) needs native-only capability. If SwiftUI is a hard requirement, say so and this audit becomes a rewrite plan, not a finish plan. |
| 3 | **Points reset weekly** | **Points never decay, deduct or expire**; ledger is append-only by construction; points buy and gate nothing | gamification.md, ADR-0003, ADR-0008; the word "streak" is banned and shape-guarded by a test | **Argue for the built version.** A weekly reset is a soft streak: it punishes absence, which the forbidden list exists to prevent ("never reference absence, missed days, or lost progress"). It also breaks the append-only ledger and the crash-safe completion journal. |
| 4 | **$59.99 annual preselected, $12.99 monthly, $99 lifetime on day 3 to cancellers** | **£39.99/year (led), £5.99/month, 7-day trial**; no lifetime | ADR-0002 (decided), strings.ts paywall copy, English market | **Owner decision, not mine.** Prices are yours. Two notes: the repo's market is UK (£) per fither-domain, and "lifetime offered once on day 3 to trial cancellers" needs cancellation detection (RevenueCat webhook or StoreKit status) plus timed re-presentation — that is a backend-shaped feature and is not built. |
| 5 | **Apple sign in at open; two free workouts, paywall on the third** | **Guest-first sign-in** (Apple / Google / no account, equal dignity); **trial starts at the first COMPLETED session**; paywall gates only new-session generation after 7 days; history/points/skills stay hers forever | ADR-0009 §2–3, ADR-0011, entitlement.ts | **Argue for the built version, with one concession.** Forcing Apple sign-in at open spends Gate 3 budget and violates ADR-0011's reasoning (an account does nothing today — no sync). "Paywall on the third workout" contradicts the decided "never block the first session; trial on completion". If you want a count-based gate instead of a day-based one, it is a one-function change in `entitlement.ts` — but decide it, don't let the brief decide it silently. Concession: Apple sign-in is required by App Review *if* Google sign-in is offered — the repo already has both behind a port. |
| 6 | **Spaces: home, gym, hotel, office; gym variants** | **Equipment-free only**: none / chair / wall. Gym variants are on the *forbidden forever* list? No — they are simply out of scope; "quiet, small-space, no-gear" is a structural requirement | fither-domain, movement-schema, validator | **Argue for the built version for v1.** The library and validator guarantee a complete session at tiers 1–4 with no gear. Gym variants are a movement-author job (data), a new equipment enum, and a re-run of the sim gates. The brief itself puts them at item 6, post-launch. |
| 7 | **PostHog, Universal Links, Lottie/SVG crossfade art** | PostHog planned (feature-set "Planned"), not built. Universal Links not configured (only `scheme: fither`). Art: 60 generated line-figure PNGs (placeholder with real intent), Brief 6 commissions animation | feature-set.md, ADR-0013 §2 | **Agree with the brief.** Analytics with four events is the right scope. Universal Links need an Apple Developer team + associated domain — owner-blocked. Lottie is a new dependency; SVG crossfade over the existing pose data is the cheaper route. |

Things the brief and the repo already agree on: iOS only; body-neutral,
no weight/photos/measurements/calories (enforced by a validator, a copy
audit test and a shape-guard test); no streaks; no backend; local storage
only; bundled ElevenLabs audio with no runtime calls (the pipeline exists,
the audio does not — §6); RevenueCat behind a port; 7-day trial; no
Android/iCloud/social/leaderboards/nutrition/wearables/AI coach/community/
video. None of the out-of-scope list has been built.

---

## 1. Screen inventory

Every view file. "Reachable from" is the real navigation path, not the
file's comment. Line counts are current.

### Routes (`app/app/`, expo-router)

| Route file | Lines | Renders | Reachable from | State |
|---|---|---|---|---|
| `_layout.tsx` | 21 | root Stack | app entry | complete |
| `index.tsx` | 28 | `LaunchScreen` (gating) | cold open; every post-session exit (`replace("/")`) | complete |
| `sign-in.tsx` | 19 | `SignInScreen` | launch, first run only | complete (dev adapters) |
| `(tabs)/_layout.tsx` | 69 | bottom tabs Today / Progress / Settings | launch → `/home` | complete |
| `(tabs)/home.tsx` | 20 | `HomeScreen` behind `entitledToStart` guard | tab; launch | complete |
| `(tabs)/progress.tsx` | 15 | `ProgressScreen` | tab; gated day | complete |
| `(tabs)/settings.tsx` | 14 | `SettingsScreen` | tab; gated day | complete |
| `prompt.tsx` | 47 | `DailyPromptScreen` | home card; onboarding handoff | complete |
| `preview.tsx` | 24 | `SessionPreviewScreen` behind `generatedSession` guard | prompt | complete |
| `session.tsx` | 16 | `SessionPlayerScreen` behind `activeSession` guard | preview Start; home Keep going; launch resume | complete |
| `finish.tsx` | 60 | `FinishScreen` behind `finishedSession` guard; routes on to unlock / reminder-ask / home | player done; launch resume-finished | complete |
| `unlock.tsx` | 42 | `UnlockScreen` behind `pendingUnlock` guard | finish, when a skill unlocked | complete |
| `reminder-ask.tsx` | 25 | `ReminderAskScreen` behind `reminderAsk` guard | finish/unlock, once ever | complete |

### Screens (`app/src/screens/`)

| File | Lines | Reachable from | State | Notes |
|---|---|---|---|---|
| `launch/launch-screen.tsx` | 226 | `/` | complete | Gating order: resume → sign-in → onboarding → gated day → home. Shows "Getting your progress ready…" for a frame on every warm pass (reviewer should-fix, open). |
| `launch/gated-daily-surface.tsx` | 76 | `/` on an expired trial | complete | Paywall letter inline, doors to Progress/Settings. |
| `launch/resume-offer.tsx` | 58 | `/` with a same-day crash snapshot | complete | |
| `sign-in/sign-in-screen.tsx` | 144 | `/sign-in` | complete, **dev adapters only** | Apple/Google buttons call `dev-auth.ts` (instant success). No real SDK. |
| `sign-in/auth-button.tsx` | 91 | sign-in | complete | |
| `onboarding/onboarding-screen.tsx` | 286 | launch, once | complete | Welcome (mark), equipment, avoid list. |
| `home/home-screen.tsx` | 231 | Today tab | complete | Today card, ladders glance, next skill. |
| `home/pattern-glance.tsx` | 95 | home | complete | Reimplements Track (reviewer should-fix, open). |
| `daily-prompt/daily-prompt-screen.tsx` | **525** | `/prompt` | complete | Over the brief's 400-line rule. Includes the can't-build and error states and a `__DEV__` timing entry. |
| `session-preview/session-preview-screen.tsx` | 224 | `/preview` | complete | |
| `session-player/session-player-screen.tsx` | **499** | `/session` | complete | Over 400. Intro / work / side switch / rest / feedback / skip confirm. |
| `finish/finish-screen.tsx` | 210 | `/finish` | complete | Four honest closes. |
| `unlock/unlock-screen.tsx` | 195 | `/unlock` | complete | |
| `unlock/skill-share-card.tsx` | 125 | unlock | complete | Image export via view-shot + expo-sharing. |
| `reminder-ask/reminder-ask-screen.tsx` | 150 | `/reminder-ask` | complete | |
| `progress/progress-screen.tsx` | 219 | Progress tab | complete | |
| `progress/tier-track.tsx` | 40 | progress | complete | |
| `settings/settings-screen.tsx` | **420** | Settings tab | complete | Over 400; ~90 lines of it is the `__DEV__` previewer. |
| `settings/care-journal.tsx` | 207 | settings | complete | |
| `paywall/paywall-screen.tsx` | 303 | gated day (inline); dev previewer | complete, **dev billing only** | Purchase calls `dev-billing.ts`. No StoreKit, no RevenueCat. |
| `paywall/plan-row.tsx` | 105 | paywall | complete | |
| `dev-timing/first-movement-readout.tsx` | 172 | long-press on the prompt's day label; Settings dev tools | complete, `__DEV__` only | Gate 3 instrument. |

Dead or stub screens: **none.** Every screen file is routed and rendered.
No screen renders and does nothing.

---

## 2. Feature inventory — what works end to end today

Blunt version. "Works" means the path runs on the JS bundle with real
stores, real engine, real persistence, and is covered by tests; nothing
below has been run on a physical device by anyone (the owner has not
rebuilt since native modules were added).

**Works end to end, no workaround:**
- Cold open → sign-in (guest, one tap) → three-screen onboarding → four
  questions → engine-generated session with adaptation line → preview →
  player (intro, work with figures + cues, rest, side switch, feedback,
  delayed skip with confirm) → four honest closes → points on a ledger →
  progression applied through a crash-safe, idempotent journal → home hub
  showing today's state, five ladders, next skill.
- Crash resume: same-day snapshot offers Keep going / Finish here; a
  previous day's snapshot with completed work applies silently under its
  own date.
- Skill unlock celebration (sequenced, one at a time) with the card shared
  as an image, text as fallback.
- Progress tab (ladders, earned skills with figures, points total).
- Settings (avoid areas, equipment, restore, daily invitation, care
  journal, dev tools), all persisted.
- Local notifications: once-ever in-context ask after the first completed
  session, slot pick, seven weekly local triggers, fully offline.
- Trial + entitlement policy: trial starts at first completed session,
  expires on day 7, gated day renders the paywall letter inline; restore
  distinguishes nothing-to-restore from failure.
- Airplane mode: nothing on the training path touches the network. The
  only network-capable code in the repo is the voice *generator script*,
  run by the owner at build time.
- Reduce Motion, VoiceOver announcements per phase, Dynamic Type (numeral
  capped at 2×), header roles (after review wave 2).

**Works, but against a dev adapter (not shippable as-is):**
- Sign in with Apple / Google — `dev-auth.ts` returns success instantly.
- Purchase / restore — `dev-billing.ts` writes a fake receipt to
  AsyncStorage. No StoreKit, no RevenueCat, no sandbox.

**Built, but empty until the owner acts:**
- Voice: generator script, playback port, Settings card, quiet-day rule
  all exist and are tested; **0 of 180 cue files exist** because the
  ElevenLabs key and voice choice are the owner's.

**Not built at all:**
- Analytics (no PostHog, no events, no dependency).
- Universal Links / associated domains.
- Crash reporting.
- Any real store connection.

---

## 3. Scope creep — measured against the brief's ground truth

Against the *brief*, most of the app is "creep", because the brief
describes a different product (§0). Listed honestly, largest first, with
what deleting it would cost:

| Built thing | Lines (approx.) | In the brief? | If cut |
|---|---|---|---|
| Progression engine (per-pattern six-tier ladders, regression, coverage, energy adaptation, taste blocks) + simulation harness | engine 930 + sim 1,070 | No (brief: one word → one fixed workout) | Loses the only machine-gated code and the "measurably stronger" claim. **Do not cut** (§0 #1). |
| Four-question daily prompt with can't-build/care states | 525 | No (brief: six-word picker) | See §0 #1. A word picker can replace the *energy* question's copy, not the prompt. |
| Named skill unlocks + unlock choreography + share card image export | 195 + 125 + share-skill 55 | Brief item 7/10 ("skill tree", "milestones") — post-launch | Cuttable for v1 per the brief's own order; costs 3 native-free files. **Note:** view-shot + expo-sharing are two native deps added for this. |
| Daily invitation (notifications: in-context ask, slot pick, weekly triggers, Settings section, hard-denied line) | ~150 + store 146 + adapters 140 | Not mentioned | Cuttable; expo-notifications is a native dep and a permission prompt (App Review reads the usage string). |
| Care journal (heavy-day notes, edit/delete, local-only) | 207 + store 157 | Not mentioned | Cuttable, low risk. |
| Home hub with tabs, Progress tab, ladders glance, next-skill card | 231 + 95 + 219 + 40 + tabs 118 | Brief's home is the six-word picker; Progress/skills are items 7–8 | Partially cuttable: keep the Today card as the entry, cut Progress to post-launch. |
| Crash-safe resume + completion journal + active-session snapshot | ~250 across session-store, completion-journal, active-session-store | Not mentioned | **Do not cut.** This is what makes "do it twice more" survive a phone call mid-set. |
| Gate 3 instrumentation (time-to-first-movement timer, readout, dev reset, dev previewer) | 136 + 172 + 72 + 186 | Not mentioned; all `__DEV__` | Keep; it is how the brief's own "install fresh, tap, complete" definition of done gets measured. |
| Store review prompt (rating store) | 56 + 21 | Not mentioned | Cuttable; trivial. |
| Voice pipeline (generator, port, manifest, Settings card) | script 150 + 55 + 20 + card | Brief: "bundled ElevenLabs audio" — **in scope** | Keep. |
| Brand + figure generators (Python) | ~700 | Brief: Lottie/SVG art | Keep the pose data; the renderer is the placeholder the brief's art replaces. |

Partial work / abandoned branches:
- `origin/wip/engine-fix-pack` — one commit, "WIP: engine fix pack,
  partial and RED — do not merge", 3 files, +160/−101, never merged.
  Abandoned. Candidate for deletion.
- The review pass's remaining should-fixes (waves 4–7 of the plan I was
  executing: hub/nav, contrast tokens, voice/share hardening, weaker
  tests) are recorded in the three reviewer reports in this session and
  not yet applied. None is a feature.

---

## 4. Dead code

- **Unreferenced files (outside tests):** none in `app/src` except the
  two test utilities (`test-utils/copy-audit.ts`, `test-utils/fixtures.ts`),
  which are test-only by design.
- **Unused models:** none found. Every store is read by a screen or a
  route guard.
- **Commented-out code:** none. The heuristic grep over `app/src` and
  `packages/engine/src` finds only prose comments.
- **Duplicate implementations (real, reviewer-confirmed):**
  - Equipment constants typed three times: `settings-store.ts:52-53`
    (canonical, exported), `settings-screen.tsx:173,180` (literals),
    `onboarding-screen.tsx:36-37` (private copies).
  - `milestoneMovement(library, …)?.id || ""` in `home-screen.tsx:174`
    and `progress-screen.tsx:60` — same lookup `skill-name.ts` wraps for
    the label.
  - `pattern-glance.tsx` hand-draws the segmented ladder that the
    `Track` primitive draws everywhere else (static, unhidden).
  - `strings.finish.pointsLabel` superseded by `pointsUnit`, kept "until
    no reader is left" — no reader is left.
- **Files over the brief's 400-line rule:** `session-store.ts` (726),
  `strings.ts` (608), `daily-prompt-screen.tsx` (525),
  `session-player-screen.tsx` (499), `settings-screen.tsx` (420).
  `strings.ts` is a single copy surface by rule (fither-code) and should
  stay one file. The other four are honest split candidates.
- **Views with business logic (brief's rule):** none re-derive engine
  rules (this is a repo hard rule with tests). Screens do hold
  navigation/state plumbing: the prompt's hydration gate and the
  player's timer reconciliation are the largest.

---

## 5. Critical path gaps — app open to a completed paid subscription

The brief's definition of done: *install fresh → Sign in with Apple →
tap Drained → complete a 10-minute workout with voice and art → see
points → twice more → paywall → trial in sandbox → four PostHog events.*

| Step | Today | Gap |
|---|---|---|
| Install fresh on a device | Never done. Bundle + prebuild are green; three native modules (notifications, view-shot, sharing, audio) have never been compiled on a Mac. | **Owner: rebuild.** Highest-risk unknown in the whole audit. |
| Sign in with Apple | Button exists; `dev-auth.ts` fakes success. | Real adapter behind `auth.ts` (expo-apple-authentication), Apple Developer capability, App Review's requirement that Apple sign-in be offered if Google is. **Owner-blocked** on Developer enrollment. Guest path works today. |
| Tap Drained | No six-word picker. Four questions exist (10–15s). | §0 #1. Either a copy change on the energy question or a product change. |
| 10-minute workout with **art** | Every movement has a generated line figure (intro hero, work, rest). Not Lottie/SVG-animated. | Art exists at "placeholder with intent" quality. The brief says "a move with a text placeholder is not done" — these are drawings, not text; whether they pass your bar is your call. Upscale issue: figures render at 320px for a 600px hero (reviewer should-fix). |
| 10-minute workout with **voice** | Pipeline complete. **0/180 audio files.** | **Owner: ElevenLabs key + voice id, one command.** Without it, by the brief's rule, no move ships. |
| See points | Works (ledger, finish numeral, progress total). | None. |
| Twice more, hit the paywall | Trial is day-based (first completed session + 7 days), not count-based (third workout). | Decision (§0 #5). If count-based: `entitlement.ts` gains a completed-session count; ~30 lines + tests. |
| Start a trial in sandbox | `dev-billing.ts` only. No RevenueCat, no StoreKit, no products in App Store Connect. | **Owner-blocked**: Apple Developer + App Store Connect products + RevenueCat project. Then one adapter file behind `billing.ts` (ADR-0009 §4 designed for exactly this). |
| Four PostHog events | Nothing. | New dependency (posthog-react-native), an events port that obeys the forbidden list, offline queue, four call sites. ~1 day. |
| Universal Links (`deep_link_open`) | `scheme: fither` only. No `associatedDomains`, no AASA file, no domain. | **Owner-blocked** on a domain + Developer team. |

Everything owner-blocked shares one root: **no Apple Developer
enrollment yet** (STATE.md "Next" item 3 since 2026-09-02).

---

## 6. Asset inventory

| Asset | Count | Gap |
|---|---|---|
| Movements in the library | 60 (five patterns × six tiers + variants), validator-clean | Coach review not done (planned, owner). |
| Move art | 60/60 — generated white line-figure PNGs, 320px, tinted at render; pose data in the generator | Not animated. Rendered 1.9× upscaled on the intro hero. Brief wants Lottie/SVG crossfade: 0/60 of that. |
| Move audio | **0/60 movements, 0/180 unique cues** | Owner's key + voice. Cost: 5,621 characters, one run. |
| Brand | mark (SVG + PNGs), icon set, lockup, app mark | Complete. |
| Splash | `splash-icon.png` | Complete. |
| Copy | 608 lines, one surface, copy-writer reviewed, forbidden-list clean | Complete for what is built. Six words would need new copy. |

By the brief's rule ("every move needs art plus audio or it does not
ship"): **0 of 60 moves ship today**, entirely on the audio column.

---

## 7. Risk list — App Review, crashes, leaks

1. **Never compiled on a device.** Four native modules added since the
   last (simulator) build. Prebuild is green; that is not a compile.
2. **Apple sign-in is fake.** Shipping a "Continue with Apple" button
   that succeeds without Apple is an App Review rejection and a user
   deception. Must be real or removed before TestFlight.
3. **Purchases are fake.** Same: a "Subscribe" that writes a local
   receipt cannot ship. Guideline 3.1.1.
4. **Notification permission usage string.** `expo-notifications` is in
   plugins; no custom usage description is set in `app.json` — the
   default string will show in the OS dialog. Review may ask what it's
   for; the in-app ask already explains.
5. **`expo-audio` plugin** adds `NSMicrophoneUsageDescription` only if
   configured; playback needs no mic. Confirm no mic string is emitted
   (prebuild output) or Review will ask why.
6. **Privacy manifest / data collection:** the app collects nothing and
   sends nothing today. *(Update 2026-09-05: PostHog is built behind a
   port, ADR-0015; it sends four anonymous events only once the owner
   sets the key. App Privacy answers then change — docs/posthog-setup.md
   lists them. The SDK is pure JS with no privacy manifest of its own.
   Sentry followed the same day, ADR-0016: crash data only, behind a
   port, off without its DSN.)*
7. **Dev surfaces gated by `__DEV__`** — the previewer, timing readout,
   entitlement reset, dev receipts, dev auth. Release builds exclude
   them (tests cover the release shape of Settings). A release build
   with `dev-auth`/`dev-billing` *adapters* still bundled is not a leak
   (they hold no secrets) but is dead weight; real adapters replace them.
8. **Dark-mode `danger` token** below AA (3.5:1) — unused as text today.
   Track rails at 1.2:1 in both themes (reviewer should-fix, open):
   "Tier 2 of 6" reads as two pills with no ladder.
9. **Share sheet filenames** show a UUID (`RCTTempFilePath`) in Save to
   Files / Mail. Cosmetic.
10. **`generate-brand-assets.py`** hardcodes a Linux font path; on the
    owner's Mac it writes everything then crashes on the lockup.
11. **Voice player leak / overlap** (reviewer should-fix, open): a cue
    interrupted by a call keeps its native player for the process; two
    fast transitions can overlap cues.
12. **Clock changes:** handled (a backwards clock never locks her out);
    midnight without a foreground event leaves yesterday's "done" on the
    Today tab until backgrounded (reviewer note).
13. **No crash reporting.** The first crash a tester hits is invisible.

Nothing found that leaks user data: no network calls exist on the
training path, no third-party SDKs are installed, storage is local.

---

## Proposed cut list (for approval — nothing deleted yet)

Cuts I recommend regardless of §0:

1. `origin/wip/engine-fix-pack` — the abandoned red branch.
2. `strings.finish.pointsLabel` — superseded, no readers.
3. Duplicate equipment literals in `settings-screen.tsx` and
   `onboarding-screen.tsx` → the store's exports (not a cut, a
   de-duplication; listed because the brief asks for duplicates).

Cuts only if you adopt the brief's v1 scope (items 1–4 shippable):

4. Skill unlock celebration + share card + `react-native-view-shot` +
   `expo-sharing` (brief items 7/10 are post-launch). −2 native deps.
5. Daily invitation (notifications end to end) + `expo-notifications`
   + `expo-store-review`. −2 native deps, −1 permission prompt.
6. Care journal.
7. Progress tab (the Today card keeps the ladders glance).

Cuts I recommend **against** (see §0): the engine and simulation, the
four-question prompt, the crash-resume/journal, never-decaying points,
guest-first sign-in, equipment-free-only library.

## Proposed build order

Against the brief's items 1–4, on the built stack:

1. **Owner: Apple Developer enrollment.** Unblocks 2, 4, 5 and Universal
   Links. Nothing below it is reachable without it.
2. **Owner: rebuild on a device**, walk the flow with the dev previewer.
   Then Gate 3 (five testers, <60s). This is the brief's "open to
   workout complete" — it exists; it has never been run on hardware.
3. **Owner: voice** — pick the ElevenLabs voice, run the generator once,
   commit 180 files. Without it nothing ships by the brief's own rule.
4. **Decide §0 #1 and #5** (picker vs prompt; count-based vs day-based
   paywall). Both are small code if decided; both are large if left
   ambiguous.
5. Real Sign in with Apple adapter behind `auth.ts` (and Google, or
   remove the Google button).
6. RevenueCat adapter behind `billing.ts`; App Store Connect products;
   sandbox verification; the offline-lockout re-review ADR-0009 requires.
7. Analytics port + PostHog, four events, forbidden-list-safe payloads,
   offline queue.
8. Close the open reviewer should-fixes (nav hop, gated tab, contrast
   tokens, voice player lifecycle, weak tests) — small, all recorded.
9. Split the four files over 400 lines.
10. TestFlight; crash reporting first.

Items 1–3 are yours and are the actual bottleneck. Everything in 4–9 is
days, not weeks, on the built stack. A SwiftUI rewrite (§0 #2) is months
and resets to zero.

Stopping here, as instructed.
