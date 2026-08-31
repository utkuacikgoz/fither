# FITHER: Build System

How to actually build the app in Claude Code. Repo layout, skills, agents, session order, and the gates that stop agents from building on top of a wrong decision.

The nine briefs are the *what*. This is the *how*.

---

## 1. The principle

Agents are fast at writing code and bad at knowing when they are wrong. So the repo is structured so that being wrong is caught by a machine, not by you reading diffs at midnight.

Three mechanisms:

* **Skills hold the truth.** Product rules, domain model, and code standards live in files both you and every agent read. Not in your head, not in a prompt you retype.
* **Gates before UI.** The engine is validated by simulation before a single screen exists. If progression does not work, no amount of good UI saves it.
* **A reviewer agent that did not write the code.** Separate context, adversarial instructions.

---

## 2. Repo layout

```
fither/
  CLAUDE.md                    # loaded every session, keep it short
  .claude/
    agents/
      movement-author.md
      engine-engineer.md
      ui-engineer.md
      copy-writer.md
      reviewer.md
    skills/
      fither-domain/
        SKILL.md               # product truth: promise, format, rules
        references/
          engine-spec.md       # the algorithm, verbatim from Brief 2
          gamification.md      # points, skills, forbidden mechanics
          movement-schema.md
      fither-code/
        SKILL.md               # stack conventions, testing, file structure
      fither-voice/
        SKILL.md               # shared with the content repo, UI copy rules
  data/
    movements.json             # the 60 movements, source of truth
  packages/
    engine/                    # pure TS, zero deps, zero IO
      src/
      sim/                     # 500 user 26 week harness
      __tests__/
  app/                         # Expo app
  docs/
    adr/                       # one file per architecture decision
    briefs/                    # the nine briefs, unchanged, as reference
```

`packages/engine` being a separate package with no dependencies is not tidiness. It is what makes the simulation gate possible.

---

## 3. CLAUDE.md

Short. Long CLAUDE.md files get ignored. See the repo root `CLAUDE.md`.

---

## 4. Skills

### `fither-domain`

The single source of product truth. Every agent reads it. When you change your mind about the product, you change this file, and every future agent session inherits the change automatically. This is the highest leverage file in the repo.

Contents: the promise, the audience, the 10/20/30 format, the daily prompt questions, the engine rules, the gamification loops, the forbidden list (no weight, no calories, no streaks, no body shape language), and the pricing.

`references/engine-spec.md` holds the algorithm from Brief 2 verbatim, including the acceptance thresholds. When an agent asks "should tier advance after 2 or 3 clean sessions", the answer is in a file, not in a conversation you have to remember.

### `fither-code`

Stack conventions. Expo, TypeScript strict, file naming, where state lives, how to structure a screen, test patterns, what never to import where. Keeps five agent sessions from producing five different architectures.

### `fither-voice`

Same file as the content repo. Copy the directory across, or keep it in a small shared plugin so both repos load the identical rules. UI copy, notification copy, paywall copy and TikTok scripts all pass the same filter.

---

## 5. Agents

### `movement-author`

Owns `data/movements.json` and nothing else. Strength coach persona, Brief 1 as its instructions. Runs a validation script after every change: no orphan movements, every `progressionTo` resolves, every pattern has an unbroken tier 1 to 6 ladder, the silent plus chair plus no gear filter still yields tier 1 to 4.

### `engine-engineer`

Owns `packages/engine`. Brief 2 as instructions. Forbidden from touching the app directory. Must run `pnpm sim` and report the numbers after every change, not just claim it passes.

### `ui-engineer`

Owns `app/`. Reads the domain and code skills. Forbidden from touching the engine or the movement data. If a screen needs a rule the engine does not expose, it stops and says so rather than reimplementing the rule in the UI. That failure mode is how adaptive logic quietly ends up in three places.

### `copy-writer`

Owns every user facing string. Onboarding, session, paywall, notifications, App Store listing. Reads `fither-voice`. Strings live in one file, not scattered in components, so this agent has one surface to own.

### `reviewer`

Fresh context, never writes code. Instructions: assume the implementation is wrong and find where. Specific checks: does any session exceed its time budget, can a pattern reach zero volume over 7 days, does any path lock a paying user out offline, does any string violate the forbidden list, is engine logic duplicated in the UI. Runs before every merge.

---

## 6. Session order

Each line is one Claude Code session. Do not merge them. Long sessions drift.

**Phase 0, setup, one evening**

1. Create the repo, write CLAUDE.md, write the three skills. Do this by hand or with one agent, but read every line yourself. Everything downstream inherits these files.
2. Brief 0: scaffold, types, ADR.

**Phase 1, validate the thesis, before any UI**

3. `movement-author`: 60 movements. Expect two rounds.
4. `engine-engineer`: engine plus simulation harness.
5. **GATE 1.** Run `pnpm sim`. A 4x per week user must reach push tier 4 or higher by week 12. A 2x per week user must never regress. No session exceeds its budget. No pattern absent more than 7 days.

If Gate 1 fails, fix the engine or the movement ladders. Do not proceed. Everything after this assumes progression works.

**Phase 2, the loop**

6. `ui-engineer`: daily prompt plus session generation, ugly UI, no styling.
7. `ui-engineer`: session player state machine, no animation, no audio, placeholder blocks.
8. **GATE 2.** Do a real 10 minute workout yourself, from the ugly build. Not a simulator walkthrough. Actually train. This catches things no test will.

**Phase 3, make it real**

9. Brief 6 in parallel, outside Claude Code: identity and the 6 reference animations. Start this in week one, it is the long pole and it blocks the TikTok channel too.
10. `ui-engineer`: Rive integration, audio pipeline, voice script generation from `movements.json`.
11. `ui-engineer`: gamification, points ledger, skills, unlock screen, share card.
12. `ui-engineer` plus `copy-writer`: onboarding.
13. **GATE 3.** Five women, real phones, no help from you. Time from open to first movement. Target under 60 seconds. Watch where they hesitate, do not ask them.

**Phase 4, money and ship**

14. `ui-engineer`: RevenueCat, paywall, entitlements, offline handling.
15. `copy-writer`: App Store listing, screenshots, all remaining strings.
16. `reviewer`: full pass across everything.
17. TestFlight, 20 users, two weeks.
18. Ship.

---

## 7. Gates, restated

Three moments where you stop and check reality. They exist because agents will produce something that compiles and passes tests while being wrong about the product.

| Gate | When | Pass condition | If it fails |
|---|---|---|---|
| 1 | After the engine | Simulation thresholds met | Fix the ladders. The retention thesis is the product. |
| 2 | After the ugly loop | You complete a real 10 minute session | Fix pacing and prescription before any polish |
| 3 | After onboarding | 5 women reach first movement under 60s | Cut onboarding questions until they do |

Gate 1 is the cheapest way to kill this idea if it deserves killing. It costs two sessions and no design work.

---

## 8. Automation worth setting up

* **Scheduled task, weekly:** reviewer agent runs a full pass on the diff since last week and writes findings to `docs/review/`. Catches drift while you sleep.
* **Hook on commit:** run `pnpm test` and, if `packages/engine` changed, `pnpm sim`. An agent cannot merge a silent regression in progression.
* **Plugin:** once the three skills stabilise, bundle them so the app repo and the content repo load identical brand rules instead of two copies that diverge.

---

## 9. What agents cannot do

Be honest about this up front so it does not surprise you in week 6.

* **Rive animations.** 60 of them. This is a design job and the single largest cost. Budget for it now.
* **Voice.** Choosing the ElevenLabs voice is a taste decision. Pick it once for the app and the channel together.
* **Exercise safety judgement.** An agent will happily put a tier 3 movement in a beginner session. Have an actual coach review `movements.json` once. A few hundred dollars against real injury risk.
* **Knowing if a session feels good.** Only Gate 2 tells you that.
* **App Store submission.** Your machine, your account.

---

## 10. Realistic timeline, solo, part time

| Phase | Weeks |
|---|---|
| Setup and scaffold | 1 |
| Movements, engine, Gate 1 | 2 |
| Ugly loop, Gate 2 | 2 |
| Animations, in parallel from week 1 | 6 to 8 |
| Player, audio, gamification | 3 |
| Onboarding, Gate 3 | 1 |
| Paywall, store, review | 2 |
| TestFlight | 2 |

Roughly 13 weeks to ship, with animations as the binding constraint. The TikTok channel starts in week 1 and has 90 days of history by launch. That timing is the whole plan, not a coincidence.

---

## 11. This week

- [x] Create the repo, write CLAUDE.md and the three skills
- [ ] Brief 0 scaffold
- [ ] Start `movement-author` on the 60 movements
- [ ] Commission the 6 reference animations, Brief 6
- [ ] Start the TikTok channel with environment and text formats

Gate 1 is reachable in two weeks and tells you whether any of the rest is worth building.
