# FITHER

Equipment-free calisthenics for time-poor women. 10, 20 or 30 minute sessions
adapted daily. English market. iOS first. Solo developer.

## Before doing anything

Read `.claude/skills/fither-domain/SKILL.md`. It is the product truth.
For code, also read `.claude/skills/fither-code/SKILL.md`.
For any user-facing string, also read `.claude/skills/fither-voice/SKILL.md`.

## Hard rules

- Workout generation runs on device. The app must work in airplane mode.
- Never add a dependency to `packages/engine`. It stays pure: zero deps, zero IO.
- Never change `data/movements.json` outside the movement-author agent.
  Every change to it must pass `node scripts/validate-movements.mjs`.
- No feature ships without a test. No engine change ships without a sim run —
  report the actual numbers, never just "it passes".
- Never put engine logic in the UI. If a screen needs a rule the engine does
  not expose, stop and say so instead of reimplementing it.
- Do not build UI for anything not in the current brief.
- The forbidden list in `fither-domain` (no weight, no calories, no streaks,
  no body-shape language) applies to code, copy, analytics and data models.
- Decisions marked `DECIDE:` in any skill are unresolved. Do not guess —
  surface them. Resolved decisions get an ADR in `docs/adr/`.
- No AI attribution anywhere in the repo: no "Generated with Claude Code",
  no Co-Authored-By Claude/Codex trailers, no model names or assistant
  links in commit messages, PR titles/bodies, or code comments. Enforced
  by `.githooks/commit-msg`. This applies to every tool — Claude, Codex,
  or anything else.

## Commands

```
pnpm test                            # unit tests
pnpm sim                             # 500-user / 26-week simulation, must pass gates
pnpm ios                             # expo, simulator
node scripts/validate-movements.mjs  # movement library integrity (also runs via hook)
```

## Layout

- `data/movements.json` — the movement library, source of truth (movement-author only)
- `packages/engine` — pure TS session generator + `sim/` harness
- `app/` — Expo app
- `docs/briefs/` — the nine briefs, read-only reference
- `docs/adr/` — one file per architecture decision
