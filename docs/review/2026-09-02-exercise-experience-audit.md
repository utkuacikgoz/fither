# Exercise Experience Audit

Date: 2026-09-02  
Branch audited: `main` at `a68fa31`  
Scope: daily prompt, session preview, exercise player, finish/unlock, copy, visual system, accessibility, retention hooks, and production QA. Authentication and sign-in are explicitly out of scope because they are being built in parallel.

## Implementation status (updated 2026-09-02)

Finished:

- Full coaching cues reach the player; unilateral reps and holds explicitly
  run left → switch → right and survive legacy-session restoration.
- Skip is confirmed in every active phase and truthfully excludes the block
  from completion; soreness feedback cannot be submitted as “all good.”
- Preview shows generated blocks and prescriptions, leads with one primary
  adaptation, and supports editing prefilled daily answers.
- Completion uses a stable session ID and durable replay journal. History,
  progression, points, unlocks, trial state, and active-session cleanup
  converge on retry without duplicate awards; success copy waits for commit.
- Countdown deadlines persist with the active session and reconcile elapsed
  wall-clock time on foreground and relaunch instead of restarting.

Remaining, in production order:

1. Define and instrument the total-session time-budget contract.
2. Distinguish full completion, ended early, zero-completion, save failure, and
   already-completed-today states in product logic and copy.
3. Add hydrated route guards and preserve owned records through expired-access
   navigation.
4. Complete semantic contrast, VoiceOver announcements/focus, Dynamic Type,
   Reduce Motion, and narrow-device QA.
5. Complete qualified human-coach review of every exposed movement; only then
   validate and scale deterministic offline movement animation.
6. Build capability progress, verified skill milestones, completed-today and
   history surfaces, then measured opt-in return hooks.
7. Run the release device matrix, persistence/end-to-end qualification,
   privacy/store metadata, billing sandbox, and operational sign-off.

## Executive verdict

FITHER has a coherent product idea and a notably restrained visual foundation, but the exercise experience is not production-ready yet. The primary gap is not polish: important workout meaning is lost between the engine and the player. In particular, unilateral exercises are budgeted for two sides but played as one, and movement instruction is reduced to the first cue. Those two defects must be corrected before expanding animation, gamification, or distribution.

The production order should be:

1. Make every prescribed exercise safe, complete, and truthful.
2. Make the session understandable before and during movement.
3. Make completion durable and recovery trustworthy.
4. Add measured motivation only where it reinforces capability.
5. Finish accessibility, device QA, and release operations.

## Audit method

Five GPT-5.6 Sol specialist passes were launched across exercise flow, product copy, premium interaction design, product hooks, and integration/release QA. The app was also exercised in the iOS Simulator. Findings were reconciled against the engine specification, product voice, design system, existing tests, and current implementation. No auth or sign-in files were changed.

## P0 — production blockers

### 1. Unilateral exercises play only one side

The engine correctly charges unilateral movements at twice their per-side duration (`packages/engine/src/generate.ts`), but `toPlayerBlocks` drops the movement's `unilateral` property (`app/src/session/create-session.ts`). `PlayerBlock`, the player state machine, and the screen have no concept of sides (`app/src/session/player-machine.ts`, `app/src/screens/session-player/session-player-screen.tsx`). A side plank therefore becomes one hold rather than left and right holds; unilateral rep movements have the same defect.

Required experience:

- Preserve unilateral metadata at the engine-to-player boundary.
- Display “each side” in the block plan.
- Run an explicit first-side → switch-side → second-side sequence for every set.
- Give timed holds a fresh countdown on the second side.
- Do not count a set complete until both sides are complete.
- Add state-machine, session-creation, screen, resume, and timer tests.

Acceptance: every unilateral movement completes equal work on both sides, survives background/resume correctly, and remains within the engine's budget model.

### 2. The player discards most coaching instruction

`toPlayerBlocks` keeps only `movement.cues[0]`; the player renders that one line. Several first cues only describe setup, while the actual motion and safety direction are in later cues. This affects ordinary movements such as Wall Slide and more demanding chair and doorframe movements.

Required experience:

- Carry the full cue array into the player.
- Show the complete setup sequence before Begin.
- Present one calm, relevant cue during work and allow the sequence to progress without crowding the screen.
- Keep movement data changes under movement-author ownership and complete the deferred human coach review in `docs/coach-review.md`.
- Treat 3D animation as progressive enhancement, not a substitute for written cues or a blocker for offline use.

Acceptance: a first-time user can identify starting position, motion, stopping point, and important safety constraint without prior fitness vocabulary.

### 3. Skip behavior is ambiguous and its copy is false

The current confirmation says “Fewer reps count too. Either way is fine,” but `skipped` is intentionally treated like `struggled` by the ratified engine rules. During work and rest, skip also acts immediately; during rest, “Skip this one” can be read as skipping the rest even though it discards the exercise, including completed sets.

Required product decision: retain the ratified “skip contributes to regression” rule, make skip progression-neutral, or represent partial work. Until that decision changes through the normal domain process, the UI must disclose current behavior honestly.

Minimum safe UI:

- Label the action “Skip exercise” in every phase.
- Confirm it in every phase, not only on the intro.
- State that the exercise will not count as completed.
- Preserve completed-set truth if partial work becomes a supported outcome.
- Never use guilt, punishment, streak-loss, or cost framing.

### 4. The 10/20/30-minute promise is not enforced in the player

Generation budgets transitions and estimated rep tempo, but block intros are indefinite and rep work advances only when the user taps Done. The player gives no elapsed or remaining-session guidance. A “10-minute” workout can therefore run materially over its promise.

Required product decision: define 10/20/30 as a hard elapsed-time ceiling or clearly label it as an estimate. The recommended position for busy professionals is a hard ceiling with a small documented tolerance.

Acceptance: instrumented sessions at all three lengths stay inside the published tolerance across rep, hold, unilateral, rest, skip, background, and reduced-motion paths.

### 5. Completion is not yet transactionally trustworthy

The finish flow can present success before durable save completion, retries can risk replaying side effects, and early finish turns unfinished work into skipped outcomes without clearly reflecting that distinction. A zero-completion session can still say “Session complete. That counts.”

Required experience:

- Use one durable, idempotent completion transaction for history, points, progression, unlocks, and active-session cleanup.
- Show earned points and unlocks only after that transaction succeeds.
- Make retry safe after crash, process death, or repeated taps.
- Distinguish completed, ended-early, and save-failed states in copy and analytics.
- Verify that restored timers do not restart from their original duration.

### 6. Critical contrast and screen-reader feedback fail premium standards

In dark mode, bone text on the light sage CTA is about 2.5:1 and fails normal-text contrast. Gold text on the sage unlock background is also too low-contrast for primary information. The session has a progressbar role without a meaningful accessibility value and does not announce phase, timer, side switch, or completion changes.

Required experience:

- Split decorative/selection sage from a contrast-safe action fill rather than making one token serve incompatible roles.
- Use gold as decoration, not low-contrast body or heading text on sage.
- Announce exercise, side, set, work/rest transition, countdown milestones, and completion without creating speech spam.
- Add headings, progress values, meaningful timer labels, logical focus movement, and 44-point minimum targets.
- Test large Dynamic Type, VoiceOver, Reduce Motion, dark mode, and narrow devices.

### 7. Expired access hides records the user still owns

The launch screen currently replaces the whole app surface with the expired paywall. This contradicts ADR-0009 and the entitlement policy, which gate new-session generation while leaving history, points, skills, and settings accessible.

Required experience:

- Gate “Make today's session,” not the application shell.
- Keep Progress and Settings available after expiry.
- State the boundary plainly: “Your record stays yours. Subscribe to make a new session.”
- Test expired, offline, restored-purchase, and failed-purchase paths independently.

### 8. Public routes can render blank or false-success states

The app declares a public URL scheme, but preview and session routes can render blank without hydrated state; finish can claim completion without a completed session; unlock can show an empty celebration.

Required experience:

- Centralize hydration-aware route guards.
- Validate and migrate restored snapshots before rendering.
- Route invalid preview/session/finish/unlock states to a calm, valid destination.
- Add a deep-link matrix and corrupted-snapshot tests.

## P1 — high-impact experience work

### Make the preview a real contract

The preview currently reports a movement count but not the actual plan, despite the design brief requiring a block list. It can also render every adaptation as a paragraph.

- Show movement name, sets, reps/seconds, and “each side” where relevant.
- Lead with one primary adaptation sentence; place secondary adjustments behind a calm disclosure if needed.
- Preserve a visible edit/back path to today's answers.
- Keep the start action reachable with large text and smaller screens.

### Fix daily-prompt mapping

- Hide “All good” when temporary sore areas are selected, or define it clearly as a reset action.
- Surface persistent avoids as “Already working around …” and let the user distinguish them from today's additions.
- Replace the soreness CTA “Noted. We'll work around it.” with an action such as “Build today's session.”
- Preserve time, energy, and quiet answers when no safe session can be generated; return to the work-around step.
- Resolve the quiet question: every current movement is marked silent, so today the answer does not change the plan.

### Remove claims the product has not earned

- Tier advancement currently unlocks the next movement before the user has performed it. Replace “my body can do this now” with honest unlock language, or move the celebration to verified completion of that skill.
- The visible share card currently shares text only. Export the visual artifact or present it as a text-share action.
- Give sharing failures one calm line; keep user cancellation silent.
- Sequence multiple unlocks one at a time so they cannot clip or become a feed.

### Make recovery and closure specific

- Replace generic “Try again” labels with the operation being retried.
- Change resume copy to “Completed exercises are saved” until partial-set persistence exists.
- Give the finish action a truthful destination such as “Back to today,” and land on a completed-today state instead of immediately reopening the questionnaire.
- Treat “ended early” as a valid, distinct close rather than pretending it was a completed session.
- Replace generic `advance` with phase-scoped events or interaction locks so rapid repeated taps cannot end rest and immediately complete the following rep set.

### Remove write-only sensitive data

The care note infers an emotional event from body-area selections, stores potentially sensitive free text indefinitely, and provides no history, edit, delete, or training benefit. Remove it until it has a visible user purpose and lifecycle, or build those controls before collecting it.

## Product hooks: what to build and what to avoid

The strongest loop is competence, not compulsion:

`honest daily fit → clearly coached completion → visible capability progress → meaningful skill attempt → return when useful`

Recommended hooks:

- **Today state:** a calm completed-today surface showing what was done and the next useful action.
- **Capability path:** show the current movement, the next skill, and the evidence required to unlock or prove it.
- **Momentum without punishment:** acknowledge recent consistency and personal bests, but never use streak loss, red urgency, shame, or paywall pressure.
- **Contextual defaults:** remember useful non-sensitive preferences such as common session length while always allowing today to differ.
- **Earned celebration:** reserve the premium unlock moment for a real capability milestone, not routine point increments.
- **Useful return prompts:** notifications should invite a session when the user asked for them; they must not claim a session is ready before today's answers exist.

Do not add leaderboards, infinite feeds, random reward mechanics, aggressive streak rescue, social comparison, or mid-workout monetization. These would dilute the “stronger and more capable” promise.

The present unlock cadence also needs correction. A read-only run of the existing 500-user, 26-week harness found that 1,174 of 2,312 unlock sessions awarded multiple skills, and 3,773 of 4,911 skills arrived in batches. Milestone attempts and celebrations should be sequenced one pattern at a time; this preserves meaning and prevents layout overflow.

The current first named skill generally arrives around weeks 8–10, with slower users reaching it later. Intermediate feedback must therefore show real, engine-issued capability movement—such as a pattern advancing for the next session—without inventing claims or exposing sensitive workout outcomes to analytics.

## Copy direction

High-confidence replacements:

| Current | Recommended |
| --- | --- |
| “Noted. We'll work around it.” | “Build today's session” |
| “Skip this one” | “Skip exercise” |
| “How was that?” | “How did that feel?” |
| “Felt strong / Good / That was hard” | “Strong / About right / Hard today” |
| “Four taps and you're moving.” | “Four answers to today's plan.” |
| “Low energy: same movements, lighter volume.” | “Low energy: fewer sets at your current level.” |
| “One movement pattern rotates back in today.” | “A movement you haven't seen lately is back today.” |
| “Everything you've done is saved.” | “Completed exercises are saved.” |

Also fix singular/plural output for “movement” and “point,” move hardcoded `WORDMARK` and point formatting into the typed string surface, and replace unexplained fitness shorthand during the human coach review.

## Sequenced build plan

### Wave 1 — Exercise integrity

- [x] Add unilateral side state and full-cue transport.
- [x] Redesign intro/work/rest/side-switch/feedback states around those truths.
- [x] Confirm and clarify skip behavior without changing engine rules silently.
- [x] Add full state-machine and screen coverage, including resume.
- [ ] Complete human coach review for all exposed movements.

Exit criteria: no asymmetric prescription, no missing coaching step, no ambiguous destructive action, all tests and deterministic simulation green.

### Wave 2 — Session contract and durability

- [x] Build the real preview and answer-edit path.
- [ ] Define and instrument the time-budget contract.
- [x] Implement idempotent completion and crash-safe timer restoration.
- [ ] Build honest finish, ended-early, save-failed, and completed-today states.
  Save-pending and save-failed states are complete; the remaining semantic
  outcomes are not.
- [ ] Add hydrated route guards and expired-access navigation that preserves owned records.

Exit criteria: every visible promise survives backgrounding, process death, retry, and offline mode.

### Wave 3 — Premium comprehension

1. Add a contrast-safe semantic action palette.
2. Complete VoiceOver, Dynamic Type, Reduce Motion, focus, and narrow-device behavior.
3. Prototype one deterministic, offline-capable movement animation system with written-cue fallback; validate it with a qualified coach before scaling.
4. Sequence unlocks and make the share artifact match the share action.

Exit criteria: the flow is usable eyes-free, at maximum supported text size, in light/dark mode, and without animation or network access.

### Wave 4 — Capability-led retention

1. Add capability progress and verified skill milestones.
2. Add completed-today and history surfaces.
3. Add opt-in reminders and measured return hooks.
4. Validate activation, safe completion, week-one return, and milestone comprehension before adding more mechanics.

Analytics should remain deliberately sparse: session length, block count, screen transitions, milestone identifiers, and share-sheet result are sufficient. Do not remotely log body areas, energy, quiet preference, difficulty answers, failed attempts, care-note presence/content, or physical-performance detail.

Exit criteria: hooks improve useful completion and return without increasing skip confusion, notification opt-out, or unsafe progression.

### Wave 5 — Release qualification

1. Run unit, type, lint, deterministic simulation, persistence, and end-to-end suites from a clean checkout.
2. Exercise a device matrix covering supported iPhone sizes and OS versions.
3. Complete airplane-mode, background/foreground, interruption, low-storage, share-cancel/failure, and purchase-restore scenarios.
4. Add privacy lifecycle checks for every stored field and analytics event.
5. Complete App Store assets, support/privacy URLs, subscription disclosures, observability, and rollback readiness.

Exit criteria: every launch-checklist item has an owner, evidence link, and pass date; no P0 or unresolved safety decision remains.

## Decisions required before implementation closes

1. Is a skip a struggle, neutral outcome, or partial completion?
2. Is a skill earned at tier entry or after performing the named movement?
3. Is session length a ceiling or an estimate, and what is its tolerance?
4. Does quiet remain a question when every movement is already quiet?
5. How are persistent avoids exposed and edited day to day?
6. Is the preview limited to one primary adaptation?
7. Are care notes removed or developed into a user-controlled private journal?
8. Does sharing produce a real image card or honest text only?
9. What is the canonical completed-today destination?

## Definition of AAA quality for this product

AAA does not mean more decoration. For FITHER it means that the workout is biomechanically complete, every action has an obvious result, time promises are measurable, copy never outruns product truth, progress survives failure, accessibility is first-class, and motivation comes from genuine capability. Animation and visual polish belong only after those conditions hold.
