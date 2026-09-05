# FITHER — v1.0 feature set

The definitive list of what version 1.0 does, what it deliberately does not
do, and how done each piece is. Sources: `.claude/skills/fither-domain/`
(and its references), `.claude/skills/fither-voice/`, `docs/build-system.md`,
`docs/launch-checklist.md`, and the ADRs in `docs/adr/`. If this document
and those files ever disagree, those files win — fix this one.

Status snapshot date: 4 September 2026 (phase 3 — the visual language, ADR-0013 — shipped wave by wave). "Built" means it exists in the
repo and passes its own checks today. "In progress" means working code
exists but its reality gate (section 4) has not been passed. "Planned"
means it is committed for v1.0 but not started. Gates 1 (simulation)
and 2 (the owner's real workout) have PASSED; Gate 3 (five real users)
is what holds the "Built" app features short of done.

---

## 1. What FITHER is

**Strength that fits your life** — and each morning, a workout that fits
today (ADR-0006). FITHER is equipment-free calisthenics for
time-poor women — careers, kids, caring responsibilities — in sessions
that fit the day you are actually having: 10, 20 or 30 minutes, adapted
daily to your time, energy and environment. Many users train at home while
someone sleeps in the next room, so quiet, small-space, no-gear sessions
are a structural requirement, not an edge case. You get measurably
stronger without a gym, without gear, and without the app ever talking
about your weight. English-speaking market, iOS first, and the whole thing
works in airplane mode.

---

## 2. v1.0 feature set

### Core training loop

| Feature | What it is | Key rules | Status |
|---|---|---|---|
| Home hub | The app's face between sessions: today's card (build / keep going / the honest done state), the five ladders at a glance, and the next named skill the engine points at. Bottom tabs carry Home / Progress / Settings; the session flow sits outside the tabs so no tab bar ever appears mid-workout. | One primary action per screen; every value is a read of the stores and engine (`nextMilestone`, `todayTraining`), never a re-derived rule (ADR-0013 §4). Adds one tap before the four questions — Gate 3 is re-measured, not lowered. | Built |
| Daily prompt | Four quick questions before every session: how much time (10/20/30), how's your energy (low/okay/strong), do you need to be quiet (yes/no), anything sore today ("All good" is one tap). One decision per screen, a four-segment indicator says how far along she is, and every answer row is tappable from its first frame. | Exactly four questions, ~10–15 seconds total; adding a question means re-testing Gate 3 (ADR-0003, ADR-0006). | Built |
| Session preview | Before starting: one plain-language line explaining why today's session fits your answers (from the engine's adaptations), the block list, one Start button. | The UI renders only what the engine emitted, never re-derives a reason; a 10-minute session gets the same visual dignity as a 30-minute one (ADR-0006/0007). | Built |
| Crash-safe resume | An interrupted session is saved; relaunching the same day offers "Keep going" or "Finish here" — finishing early banks every completed block. A previous day's interruption with completed work is silently applied under its own date; one with none is cleared without comment. | Nothing she did is ever silently lost, and absence is never mentioned (ADR-0007; midnight rule from the Norman audit). | Built |
| Three session lengths | 10, 20 or 30 minutes. Never more options, never fewer. | Generation fits the budget (simulation gate), and the player enforces it live: past length +10% of ACTIVE time it wraps at the next phase boundary with the honest "That's your N minutes" close (ADR-0012 §2). | Built |
| On-device session generation | The app builds today's session from the prompt answers, your history and the movement library — no server involved. | Runs entirely on device; a paying user in airplane mode always gets a full session (hard rule, CLAUDE.md). Quiet mode, available equipment and sore areas filter movements first; if today's answers exclude everything, the app says so honestly instead of faking a session. | Built |
| Session player | Guides you through the session block by block: what to do, how many, when to rest, with coaching cues for each movement. | Cue lines come from the movement library and must work read aloud (fither-voice). Every movement has a face: a generated line figure drawn from pose data (`scripts/generate-movement-figures.py`) on the intro, work, rest and side-switch phases — placeholder craft with real intent; Brief 6's commissioned animation replaces the rendering, not the pose data (ADR-0013 §2). The progress line fills as motion; the countdown never animates per tick. Rest is hers — end-rest-early and skip controls always present. | Built |
| Session finish | Marks each block completed / struggled / skipped, feeds that back to the engine, and shows what you earned — the figures of the blocks she completed, the honest close, then the points rising in once. | Outcomes are the only input to progression — the UI never re-derives an engine rule (CLAUDE.md). Failed saves retry; work is never lost to an error. | Built |
| Offline-first | Everything the training loop needs — generation, progress, points, entitlements — lives on the phone. | Airplane mode is a hard product rule, tested explicitly before launch (launch checklist). Ops SDKs being unreachable must change nothing. | Built |

### Progression engine

| Feature | What it is | Key rules | Status |
|---|---|---|---|
| Per-pattern tiers | Five movement patterns (push, pull, squat, hinge, core), each with its own six-tier ladder. You can be tier 3 in push and tier 1 in pull. | Progression is per-pattern, never global (engine-spec). Five patterns, hinge kept separate from squat on purpose (ADR-0002). Tier 6 is terminal; progress there is volume and density. | Built |
| Advancing | A pattern moves up a tier after 3 clean sessions at the current tier AND enough calendar time there — adaptation takes weeks, not just reps. Floors: 7/14/28/42/56 days per step. | 3 clean sessions (ADR-0002) plus the ADR-0008 time floor: the first named skill lands ~week 7 of consistent training, the ladder lasts beyond six months, and nobody can buy speed with extra volume. | Built |
| Gentle regression | Struggling doesn't punish you immediately: 2 consecutive struggled sessions reduce volume at the same tier; a 3rd drops one tier. Any clean session resets it. | Volume first, tier after 3 (ADR-0003). **Absence never regresses**; **skips are progression-neutral** (ADR-0012) — only struggled work moves the counters. Taste blocks and constraint fallbacks are progression-neutral (ADR-0007). | Built |
| Pattern coverage | The engine tracks which patterns you haven't trained lately and prioritises the stalest, so short sessions still cover everything over a week. | No pattern absent for more than 7 days of training (engine-spec, simulation gate). | Built |
| Energy adaptation | Low energy: same tier, less volume — never a tier drop. Strong energy: full volume, sometimes a "taste" of the next tier late in the session. | Defaults validated by the simulation (ADR-0006); Brief 2 may still override. | Built |
| Simulation harness | 500 simulated users trained for 26 virtual weeks before any real user touches the app, proving progression works. | `pnpm sim` must pass all four Gate 1 thresholds and print the actual numbers after every engine change. Reproducible from one seed. Six personas including a low-capability one; five gates including the ADR-0008 pacing ceiling; plus a deep-dive analyzer (docs/sim-analysis.md). | Built |

### Movement library

| Feature | What it is | Key rules | Status |
|---|---|---|---|
| 60 movements | The full exercise catalogue: five ladders of six tiers (30 slots), plus variants for variety. Only equipment ever referenced: none, a chair, a wall. | `data/movements.json` is the single source of truth; every edit must pass the validator (CLAUDE.md hard rule). Wall counts as always available. | Built |
| Unbroken ladders | Every pattern has a movement at every tier 1–6, each step pointing to its next progression — no dead ends, no orphans. | Machine-enforced by `scripts/validate-movements.mjs`, which runs automatically on every edit (ADR-0001). Passing as of today: 60 movements, ladders complete. | Built |
| Quiet / small-space guarantee | Filtering to silent movements with no gear (chair and wall allowed) still leaves a complete session at tiers 1–4 for every pattern — the sleeping-toddler scenario always works. | The constraint gate in movement-schema.md, machine-checked; the easiest guarantee to silently break, so it never relies on human care. | Built |
| Coaching cues | Every movement carries 2–4 short cues ("Hands under shoulders") that double as the script for voice audio. | Written to fither-voice rules; second person, present tense, reads well aloud. | Built (data); voice audio Planned |
| Coach safety review | A real strength coach reviews the 60 movements once before launch. | Named in build-system §9 as something no automated check replaces. | Planned |

### Gamification

| Feature | What it is | Key rules | Status |
|---|---|---|---|
| Points ledger | Points for work done: 20/25/30 per completed session for 10/20/30 minutes (a 15-point base for showing up plus 5 per ten minutes), +5 per block at a newly reached tier, +25 per skill unlock. | Points are only ever added — no decay, deductions or expiry; the ledger is append-only by construction. Points buy nothing and gate nothing. The base dominates: equal consistency is never halved by session length (gamification.md, ADR-0008). | Built |
| Named skill unlocks | Tier milestones become human-meaningful skills — e.g. reaching push tier 4 unlocks "Full Push-Up" — with an unlock screen. | Skills are never lost, even if a tier later regresses. Names come from the movement library, not invented in UI code. Milestone tiers are 4 and 6 (ADR-0005); each unlocks once per lifetime — never lost, never re-earned (ADR-0007). | Built |
| Shareable skill card | A card on the unlock screen, one per skill — the drawn mark, the skill name, the honest line — captured as rendered and shared as an image through the system sheet; the v1 text share stands behind it as the fallback so the moment never meets a dead end. Multi-skill unlocks celebrate one at a time. | States the skill honestly ("now in my training"), never anything about the body. Theme-fixed: it looks the same wherever it lands. Nothing touches the network. | Built |

### Onboarding

| Feature | What it is | Key rules | Status |
|---|---|---|---|
| First-run onboarding | Three screens, one decision each — the welcome opens on the drawn mark, the equipment options each show a day-one movement's figure, then anything-to-avoid — straight into the daily prompt. Runs once, persisted. | Gate 3: five real users must reach their first movement in under 60 seconds; the app measures the number itself (time-to-first-movement instrumentation, dev readout, per-tester reset). Protocol: docs/gate-3-protocol.md. | Built (Gate 3 pending) |
| Sign-in | One first-run screen: Continue with Apple / without an account — guest is first-class and one tap (ADR-0011). Google renders only once it has a real adapter. | Auth behind a typed port; the Apple adapter is real (no name, no email requested; revocation checked at launch; cancel is not an error). Identity gates nothing on the training path; airplane mode changes nothing. | Built (Apple real; Google pending an adapter) |
| Settings | Grouped cards: persistent avoid areas, equipment (editable any day), subscription/restore, the daily-invitation slot (with the honest line after a hard OS denial), the care-notes journal (view/edit/delete, local-only), dev tools. Every persistent choice carries a visible check. | Every onboarding answer stays editable; the journal never leaves the phone; dev tools (Gate 3 reset, timing readout, flow previewer) are __DEV__-only. | Built |
| Progress | Five pattern ladders that draw themselves in (tier N of MAX_TIER), unlocked skills with each movement's figure, points total on the numeral scale. | Read-only capability view; no comparisons, no percentages; gold only on earned skills. | Built |
| Daily invitation (notifications) | Asked once, in context, after the first completed session; on allow she picks her slot (8:00/12:30/18:30) and gets one quiet local invitation a day, rotating four bodies; "No invitation" is an equal option in Settings. | An invitation, never a nag; never references absence; never claims a session exists before her four answers; fully offline (local scheduling behind a typed port). Decline is final in-app — Settings is the only way back. | Built |

### Monetization

| Feature | What it is | Key rules | Status |
|---|---|---|---|
| Subscription | $12.99/month or $59.99/year with a 7-day free trial, annual led; a $99 lifetime purchase offered once, on day 3 of the trial, only to someone who switched off auto-renew (ADR-0014). Served by the RevenueCat adapter when the key is configured (entitlement `fither_pro`, products `yearly`/`monthly`/`lifetime`), the dev adapter otherwise. | ADR-0014 prices; the store trial is the trial (ADR-0014 §6): the paywall never blocks the first session, then gates new sessions until `fither_pro` is active; a lapsed trial gates with the expired letter; history, points and skills stay hers. Manage subscription via Customer Center. | Built (adapter wired; sandbox verification pending) |
| Honest paywall | States what's included and the price, plainly. | No fake urgency, no countdowns (fither-voice); honest expired-state copy; restore distinguishes no-purchase from failure. | Built |
| Offline entitlements | Entitlement state persists on device and is evaluated offline; nothing on the training path ever waits on a network. | A paying user in airplane mode is never locked out — hard rule (fither-domain; re-review required when the real billing SDK lands). | Built (dev-mode) |

### Platform & ops

| Feature | What it is | Key rules | Status |
|---|---|---|---|
| iOS app (Expo) | iPhone app, English-speaking market first. Source-controlled EAS profiles cover simulator development, registered-device development, internal preview, and App Store production; production build numbers are remotely managed and auto-incremented (ADR-0010). | iOS first; no Android-only effort in v1 (fither-code). The owner must still link Expo/Apple accounts, confirm the bundle ID, add approved identity assets, and produce the first signed build. | In progress (build foundation committed) |
| Design system | A single set of design tokens (colour, type, spacing, motion) behind every screen — calm in colour, generous in craft: shared Card, Track, FlowProgress, AnswerRow, OptionRow and MovementFigure primitives; motion is the default inside one 250–350ms ease-out envelope; Reduce Motion lands every element in its final state. | No raw style values in screens; tokens live in one file (ADR-0004). Every screen carries a considered visual element; a wall of text is a bug (ADR-0013). Norman's six are the per-screen checklist. | Built |
| Single copy surface | Every user-facing string lives in one file, written to the coach voice. | Calm, capable, no guilt, no jargon, British-neutral English; the forbidden list applies to every surface including errors and emails (fither-voice). Strings are copy-writer polished; onboarding/paywall/notification copy staged in docs/copy pending their screens. | Built |
| Movement animations | 60 Rive animations, one per movement. | A commissioned design job, the single largest cost and the schedule's long pole (build-system §9); 6 reference animations first (Brief 6). | Planned |
| Voice audio | Each movement's cue read aloud during the work set by the app's one coach voice: generated once from `data/movements.json` by `scripts/generate-voice-audio.mjs` (ElevenLabs, keyed by cue text so nothing is billed twice), committed under `app/assets/voice/`, played offline through a static manifest. Off by default; a Settings card (present only once audio is bundled) turns it on. Silent for the whole session on a quiet day; the phone's silent switch wins. | Voice choice is a one-time taste decision made outside the build (build-system §9): the owner runs the generator with the chosen voice and key. Nothing is fetched at runtime — airplane mode changes nothing. | Built (pipeline + playback); assets pending the owner's voice |
| Crash reporting (Sentry) | Errors reach the owner before users report them. | Wired and verified with a deliberate test crash before the first TestFlight build (ADR-0002, launch checklist). | Planned |
| Analytics (PostHog) | Four events that test the retention thesis — `deep_link_open`, `workout_start`, `workout_complete`, `trial_start` — behind one typed port; PostHog selected only when its key is configured, the in-memory dev adapter otherwise. Anonymous: no identify, reset on sign-out, path-only deep links. | Payloads are closed unions the forbidden list cannot be represented in (a test scans the module); events queue offline; analytics never blocks anything (ADR-0015, fither-code). | Built (owner sets the key; docs/posthog-setup.md) |
| Transactional email (Resend) | Receipts, trial-ending and data-request emails from our own domain. | Same coach voice, under 100 words, no upsell in a receipt (fither-voice); SPF/DKIM verified before launch. | Planned |
| Feedback board (Canny) | One place for tester and user feedback, linked from settings. | Live from the first TestFlight build; triaged weekly (launch checklist). | Planned |
| Accessibility basics | Theme-true AA contrast on every action (ratio table verified both themes), VoiceOver phase announcements in the player (no tick spam; the finish screen announces the honest close), Dynamic Type with a capped numeral scale, decorative glyphs hidden on both platforms. | This audience trains in suboptimal conditions by definition. Device QA at large AX sizes remains in release qualification. | Built (device QA pending) |
| Rating prompt | The system rating ask, after leaving a completed close or an unlock — only from the second completed session onward, never colliding with the reminder ask. | Never at first open, never mid-session, no custom UI; iOS rate-limits it (launch checklist). | Built |
| Launch process | TestFlight with ~20 users for two weeks, soft launch in smaller English-speaking storefronts, phased release, first update planned before launch. | v1.0 is stable, not complete — anything wobbly is cut, not shipped (launch checklist). | Planned |

---

## 3. Deliberately NOT in v1

### Forbidden forever

These never appear — not in copy, not in data models, not in analytics,
not as "optional". If a feature idea needs one of these, the idea is wrong
for this product. The one-line rationale, from gamification.md: adherence
comes from visible capability gains and zero guilt — streaks and body
metrics buy short-term engagement by charging interest in shame, and this
audience has been overcharged by every other fitness app.

| Never | Why (gamification.md / fither-domain) |
|---|---|
| Weight — weigh-ins, weight goals, weight-loss framing | Not as optional fields, not in analytics, not in the data model; a `weight` column is a bug. |
| Calories — burn estimates, food anything | Same: cannot even be represented in the product's data. |
| Streaks — counters, "don't break the chain", any loss framing | Nothing counts consecutive days; missing a day costs the user nothing and is never mentioned. |
| Body-shape language — "tone", "sculpt", "bikini", "problem areas", before/after | Progress is what your body can DO, everywhere a word appears. |
| Leaderboards or comparison to other users | The only comparison is to your own past capability. |

A violation of this list ships as a bug of the highest severity.

### Deferred — post-v1 candidates, not commitments

Ideas the docs imply for later. None is decided; each would need its own
decision (and an ADR) before any work starts.

- **Android / Play Store launch.** The launch checklist carries a Play
  Store addendum "if/when Android ships" (device matrix, download size,
  ANR monitoring, Data safety form). v1 spends no effort on Android.
- **Shared brand plugin with the content repo.** Today the voice rules are
  copied between this repo and the content/TikTok repo; build-system §8
  suggests bundling the skills as one plugin once they stabilise so the
  two never diverge.
- **App Store preview video from the TikTok pipeline.** The launch
  checklist notes the content pipeline should make a preview video nearly
  free — listed there as "if feasible", not required for v1.
- **More movements / additional patterns (e.g. mobility work).** The
  pattern set is deliberately fixed at five (ADR-0002) and the library at
  60 movements; no current doc commits to expanding either. Growing the
  library within existing patterns is the lower-friction path; a new
  pattern would be a product decision requiring a new ADR.
- **More markets and languages.** v1 is the English-speaking market;
  wider storefronts and localisation are implied later steps, decided
  after launch data exists.

---

## 4. The three reality gates

Features in section 2 only count as done once their gate passes. The gates
exist because software can compile and pass tests while being wrong about
the product (build-system §7).

| Gate | When | Pass condition | If it fails |
|---|---|---|---|
| 1 | After the engine, before any UI | The 500-user / 26-week simulation meets all thresholds: a 4×/week user reaches push tier 4+ by week 12; a 2×/week user never regresses a tier; no session exceeds its time budget; no pattern absent more than 7 days; and no consistent persona exhausts the full ladder before week 18 (ADR-0008). | Fix the engine or the movement ladders. Nothing downstream is built until it passes. |
| 2 | After the ugly-but-working loop | The owner completes a real 10-minute workout from the build — actually training, not a simulator walkthrough. | Fix pacing and prescription before any polish. |
| 3 | After onboarding | Five women, on their own phones with no help, each reach their first movement in under 60 seconds of opening the app. | Cut onboarding questions until they do. |

As of today: **Gates 1 and 2 have PASSED.** Gate 1: all simulation gates
green across 500 users / 26 weeks, re-verified on every engine commit and
in CI (numbers in docs/STATE.md and docs/sim-analysis.md). Gate 2: the
owner trained with a real device build (2026-09-01) and confirmed pacing
and prescription after the live-testing UX pack shipped. Gate 3 is fully
built and ready to run (instrumented measurement, per-tester reset,
protocol at docs/gate-3-protocol.md); it waits only on five real users.
