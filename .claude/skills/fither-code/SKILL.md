---
name: fither-code
description: >-
  FITHER stack conventions: pnpm workspace layout, Expo + TypeScript strict,
  the pure-engine boundary, where state and strings live, file naming, test
  patterns, and what may never import what. Read this before writing or
  reviewing ANY code in this repo — engine, app, scripts or tests — so five
  sessions don't produce five architectures.
---

# FITHER code conventions

One solo developer, many agent sessions. These conventions exist so every
session produces code that looks like it came from the same hand. Deviating
is fine only via an ADR in `docs/adr/` — never silently.

## Stack

- **pnpm workspace**: `packages/engine` (pure TS library) + `app` (Expo).
- **TypeScript strict** everywhere. No `any`, no `@ts-ignore` without a
  comment stating the external cause.
- **Expo** with expo-router for navigation. iOS first; don't spend effort
  on Android-only polish.
- Node scripts in `scripts/` are plain `.mjs`, zero dependencies.

## The engine boundary (the rule that matters most)

`packages/engine` is pure: **zero runtime dependencies, zero IO, zero
globals**. No `Date.now()`, no `Math.random()`, no fetch, no storage —
time comes in through the prompt input, randomness through an injected
seeded RNG. This purity is what makes the 500-user simulation and Gate 1
possible; one sneaky dependency breaks the whole validation story.

- `app` imports from `engine`. `engine` imports from nothing.
- The engine is the only home of progression/prescription logic. If a
  screen needs a rule the engine doesn't expose, **stop and say so** — add
  an engine export, never a UI-side reimplementation. Duplicated adaptive
  logic in the UI is the failure mode this repo is structured against.
- `data/movements.json` is loaded by the app and passed into the engine as
  data. The engine never reads files.

## Where things live

- **State**: one store layer in `app/src/state/` (zustand — decided,
  ADR-0005). Screens read from hooks; no component-local
  copies of engine state. Persistence via the store layer only, and it
  must work offline — airplane mode is a hard product rule.
- **Strings**: every user-facing string in `app/src/copy/strings.ts`,
  keyed and typed. Components never contain literal user-facing text.
  This is the copy-writer agent's single surface, and it's how the
  forbidden-list check stays greppable.
- **Screens**: `app/src/screens/<screen-name>/` — one directory per
  screen: the screen component, its child components, its tests.
- **Files**: kebab-case filenames, PascalCase component exports,
  camelCase everything else.
- **Design**: every screen follows `references/design-system.md` (premium,
  calm, token-driven). Components consume tokens from
  `app/src/design/tokens.ts` only — a raw hex or ad-hoc font size in a
  screen is a bug, and it's how "calm and premium" quietly erodes.

## Testing

- No feature ships without a test. Engine: vitest unit tests colocated in
  `packages/engine/__tests__/`, plus the sim harness in
  `packages/engine/sim/` (`pnpm sim`). App: component tests with React
  Native Testing Library for logic-bearing screens.
- Engine tests assert on deterministic outputs (fixed seed, fixed inputs).
  If a test needs mocking to pass, the code under test is probably
  impure — fix the code, not the test.
- After ANY change under `packages/engine` or `data/`, run `pnpm sim` and
  report the printed gate numbers.
- Never skip, weaken or delete a failing test to get green.

## Ops stack (decided, ADR-0002)

- **Error monitoring: Sentry** (`sentry-expo`). Wired and verified with a
  deliberate test crash BEFORE the first TestFlight build. Source maps
  uploaded in the build profile; alerts reach the owner's phone.
- **Analytics: PostHog.** Events are few and deliberate — the ones that
  test the retention thesis (session started/completed by length, tier
  advanced, skill unlocked, paywall seen/converted, D1/D7 activity).
  Event names and payloads live in one typed module
  (`app/src/analytics/events.ts`); nothing logs outside it. Payloads obey
  the forbidden list — no weight, calories, streaks or body data can even
  be represented. Events queue offline and flush later; analytics must
  never block or gate anything (airplane-mode rule).
- **Transactional email: Resend**, from our own domain (SPF/DKIM
  verified). Receipts/trial-ending/data-request mails only — no marketing
  drip. Templates are copy-writer surface and pass the fither-voice
  filter.
- **Feedback board: Canny**, linked from the settings screen, live from
  the first TestFlight build.
- API keys via app config/env — never committed. The app must behave
  perfectly with every ops SDK unreachable.

## Commits and attribution

- No AI attribution, ever: no "Generated with Claude Code" / Codex
  footers, no AI Co-Authored-By trailers, no model names or assistant
  links in commit messages, PR bodies, or code comments. The
  `.githooks/commit-msg` hook rejects them; on a fresh clone run
  `git config core.hooksPath .githooks` to enable it.
- Commit messages describe the change in plain imperative English.

## Brief 0 checklist (scaffold session)

When scaffolding, also wire the safety net: a `.githooks/pre-commit` hook
running `pnpm typecheck` FIRST, then `pnpm test`, plus `pnpm sim` when
`packages/engine` or `data/` changed; CI doing the same. Typecheck comes
first because vitest and jest happily execute code `tsc` rejects — a
type error in a test file passed locally and broke CI once (e619761). The `.claude/settings.json` hook already
validates `data/movements.json` on every edit — keep it working, and keep
`core.hooksPath` pointed at `.githooks`.

## Design primitives and motion (ADR-0013)

- Reuse before adding. `app/src/design/primitives/` holds the shared
  vocabulary: `card` (every hub surface), `track` + `flow-progress` +
  `progress-line` (the app's progress forms — one 4pt pill everywhere),
  `answer-row` (a short answer list entering staggered), `option-row`
  (a settings choice inside a card), `row-button` (the prompt's answer
  unit; optional leading `figure`), `movement-figure` and `brand-mark`
  (one white asset tinted to the accent), `fade-in`.
- Every animated primitive takes `reduceMotion` as a prop and renders its
  final state when it is true. Screens read `useReducedMotion()` once and
  pass it down; a primitive never calls the hook itself.
- Nothing an animation touches may gate a press: rows are hittable from
  their first frame at their drawn position. Tests press mid-entrance.
- Generated assets are committed, never hand-edited: figures from
  `scripts/generate-movement-figures.py`, the mark from
  `scripts/generate-brand-assets.py`, spoken cues from
  `scripts/generate-voice-audio.mjs` (needs the owner's ElevenLabs key
  and voice; `--manifest-only` rebuilds the manifest from what exists).
  Regenerate; do not retouch. Nothing is fetched at runtime.
- Tests: `app/jest-setup.ts` mocks `useReducedMotion` to the settled
  default so screen tests carry no `act()` noise; the hook has its own
  unit test via `jest.requireActual`. Keep the suite at zero warnings.
