# FITHER — v1.0 feature set

The definitive list of what version 1.0 does, what it deliberately does not
do, and how done each piece is. Sources: `.claude/skills/fither-domain/`
(and its references), `.claude/skills/fither-voice/`, `docs/build-system.md`,
`docs/launch-checklist.md`, and the ADRs in `docs/adr/`. If this document
and those files ever disagree, those files win — fix this one.

Status snapshot date: 31 August 2026. "Built" means it exists in the repo
and passes its own checks today. "In progress" means working code exists
but its reality gate (section 4) has not been passed. "Planned" means it
is committed for v1.0 but not started.

---

## 1. What FITHER is

Strength you can actually keep. FITHER is equipment-free calisthenics for
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
| Daily prompt | Four quick questions before every session: how much time (10/20/30), how's your energy (low/okay/strong), do you need to be quiet (yes/no), anything sore today ("All good" is one tap). | Exactly four questions, ~10–15 seconds total; adding a question means re-testing Gate 3 (ADR-0003). | In progress |
| Three session lengths | 10, 20 or 30 minutes. Never more options, never fewer. | The session must fit its time budget — running over is a bug and a simulation gate (Gate 1 #3). | In progress |
| On-device session generation | The app builds today's session from the prompt answers, your history and the movement library — no server involved. | Runs entirely on device; a paying user in airplane mode always gets a full session (hard rule, CLAUDE.md). Quiet mode, available equipment and sore areas filter movements first. | In progress |
| Session player | Guides you through the session block by block: what to do, how many, when to rest, with coaching cues for each movement. | Cue lines come from the movement library and must work read aloud (fither-voice). Currently placeholder visuals — animation and audio land in Phase 3. | In progress |
| Session finish | Marks each block completed / struggled / skipped, feeds that back to the engine, and shows what you earned. | Outcomes are the only input to progression — the UI never re-derives an engine rule (CLAUDE.md). | In progress |
| Offline-first | Everything the training loop needs — generation, progress, points, entitlements — lives on the phone. | Airplane mode is a hard product rule, tested explicitly before launch (launch checklist). Ops SDKs being unreachable must change nothing. | In progress |

### Progression engine

| Feature | What it is | Key rules | Status |
|---|---|---|---|
| Per-pattern tiers | Five movement patterns (push, pull, squat, hinge, core), each with its own six-tier ladder. You can be tier 3 in push and tier 1 in pull. | Progression is per-pattern, never global (engine-spec). Five patterns, hinge kept separate from squat on purpose (ADR-0002). Tier 6 is terminal; progress there is volume and density. | In progress |
| Advancing | A pattern moves up a tier after 3 clean sessions at the current tier (clean = no block of that pattern marked "struggled"). | Advance after 3 clean sessions; the counter resets on a struggled block (ADR-0002). | In progress |
| Gentle regression | Struggling doesn't punish you immediately: 2 consecutive struggled sessions reduce volume at the same tier; a 3rd drops one tier. Any clean session resets it. | Volume first, tier after 3 (ADR-0003). **Absence never regresses** — a 2×/week user must never lose a tier; missing days costs nothing. | In progress |
| Pattern coverage | The engine tracks which patterns you haven't trained lately and prioritises the stalest, so short sessions still cover everything over a week. | No pattern absent for more than 7 days of training (engine-spec, simulation gate). | In progress |
| Energy adaptation | Low energy: same tier, less volume — never a tier drop. Strong energy: full volume, sometimes a "taste" of the next tier late in the session. | Working defaults marked PROPOSED in engine-spec pending Brief 2. | In progress |
| Simulation harness | 500 simulated users trained for 26 virtual weeks before any real user touches the app, proving progression works. | `pnpm sim` must pass all four Gate 1 thresholds and print the actual numbers after every engine change. Reproducible from one seed. | Planned |

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
| Points ledger | Points for work done: 10/20/30 per completed session by length (1 per minute), +5 per block at a newly reached tier, +25 per skill unlock. | Points are only ever added — no decay, deductions or expiry; the ledger is append-only by construction. Points buy nothing and gate nothing (gamification.md, ADR-0003). | In progress |
| Named skill unlocks | Tier milestones become human-meaningful skills — e.g. reaching push tier 4 unlocks "Full Push-Up" — with an unlock screen. | Skills are never lost, even if a tier later regresses. Names come from the movement library, not invented in UI code. Which tiers count as milestones is currently a PROPOSED default (4 and 6). | In progress |
| Shareable skill card | A card you can share when you unlock a skill. | States the skill, never anything about the body (gamification.md, fither-voice). | Planned |

### Onboarding

| Feature | What it is | Key rules | Status |
|---|---|---|---|
| First-run onboarding | The shortest possible path from install to moving: whatever setup is truly needed, then straight into the daily prompt. | Gate 3: five real users must reach their first movement in under 60 seconds from opening the app; if not, questions get cut (build-system). Every word passes fither-voice. | Planned |
| Notification permission ask | Asked in context — after the first completed session, when the value is obvious — never at first open. | Notifications are an invitation, never a nag; they never reference absence (launch checklist, fither-voice). | Planned |

### Monetization

| Feature | What it is | Key rules | Status |
|---|---|---|---|
| Subscription | £5.99/month or £39.99/year with a 7-day free trial, via RevenueCat. Annual is the plan the paywall leads with. | Decided in ADR-0002 (GBP reference prices; other storefronts via Apple's tiers). | Planned |
| Honest paywall | States what's included and the price, plainly. | No fake urgency, no countdown timers, no "only today" (fither-voice). | Planned |
| Offline entitlements | Once you've paid, the app never checks your subscription against the network before letting you train. | A paying user in airplane mode is never locked out — hard rule (fither-domain, reviewer checklist). | Planned |

### Platform & ops

| Feature | What it is | Key rules | Status |
|---|---|---|---|
| iOS app (Expo) | iPhone app, English-speaking market first. | iOS first; no Android-only effort in v1 (fither-code). | In progress |
| Design system | A single set of design tokens (colour, type, spacing) behind every screen — premium and calm. | No raw style values in screens; tokens live in one file (ADR-0004). | In progress |
| Single copy surface | Every user-facing string lives in one file, written to the coach voice. | Calm, capable, no guilt, no jargon, British-neutral English; the forbidden list applies to every surface including errors and emails (fither-voice). Current strings are first-draft pending copy-writer polish. | In progress |
| Movement animations | 60 Rive animations, one per movement. | A commissioned design job, the single largest cost and the schedule's long pole (build-system §9); 6 reference animations first (Brief 6). | Planned |
| Voice audio | Spoken coaching generated from the movement cues, one chosen voice shared with the content channel. | Voice choice is a one-time taste decision made outside the build (build-system §9). | Planned |
| Crash reporting (Sentry) | Errors reach the owner before users report them. | Wired and verified with a deliberate test crash before the first TestFlight build (ADR-0002, launch checklist). | Planned |
| Analytics (PostHog) | A handful of deliberate events that test the retention thesis — session started/completed, tier advanced, skill unlocked, paywall seen/converted. | Payloads obey the forbidden list (no weight/calorie/streak data can even be represented); events queue offline; analytics never blocks anything (fither-code). | Planned |
| Transactional email (Resend) | Receipts, trial-ending and data-request emails from our own domain. | Same coach voice, under 100 words, no upsell in a receipt (fither-voice); SPF/DKIM verified before launch. | Planned |
| Feedback board (Canny) | One place for tester and user feedback, linked from settings. | Live from the first TestFlight build; triaged weekly (launch checklist). | Planned |
| Accessibility basics | Dynamic Type, readable contrast, VoiceOver-usable session player, text equivalents for audio. | This audience trains in suboptimal conditions by definition (launch checklist). | Planned |
| Rating prompt | The system rating ask, shown after a completed session or skill unlock. | Never at first open, never mid-session, no guilt framing (launch checklist). | Planned |
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
| 1 | After the engine, before any UI | The 500-user / 26-week simulation meets all four thresholds: a 4×/week user reaches push tier 4+ by week 12; a 2×/week user never regresses a tier; no session exceeds its time budget; no pattern absent more than 7 days. | Fix the engine or the movement ladders. Nothing downstream is built until it passes. |
| 2 | After the ugly-but-working loop | The owner completes a real 10-minute workout from the build — actually training, not a simulator walkthrough. | Fix pacing and prescription before any polish. |
| 3 | After onboarding | Five women, on their own phones with no help, each reach their first movement in under 60 seconds of opening the app. | Cut onboarding questions until they do. |

As of today: none of the three gates has been run. The movement library's
own machine gate (the validator) passes; Gate 1 is the next milestone and
is blocked on the simulation harness.
