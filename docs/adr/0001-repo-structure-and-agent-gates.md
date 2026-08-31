# ADR-0001: Repo structure, skills as truth, and machine gates

- Status: accepted
- Date: 2026-08-31

## Context

FITHER is built solo, largely through agent sessions. Agents are fast at
writing code and bad at knowing when they are wrong, so the repo must make
being wrong detectable by machines, not by reading diffs.

## Decision

1. Product truth, code conventions and voice rules live in three skills
   under `.claude/skills/` (fither-domain, fither-code, fither-voice).
   Every agent session reads them; changing the product means changing
   those files first.
2. `packages/engine` is a pure, dependency-free TypeScript package so a
   500-user / 26-week simulation can gate every engine change (Gate 1)
   before any UI exists.
3. Five agents with disjoint surfaces (`.claude/agents/`): movement-author
   (data), engine-engineer (engine), ui-engineer (app), copy-writer
   (strings), reviewer (read-only, adversarial, pre-merge).
4. `data/movements.json` is machine-validated: `scripts/validate-movements.mjs`,
   run automatically by a PostToolUse hook on every edit.
5. Git hooks are versioned in `.githooks/` (`core.hooksPath`). The
   commit-msg hook rejects AI attribution; Brief 0 adds pre-commit
   test/sim runs.
6. Unresolved product choices are marked `DECIDE:` in skills; resolving
   one requires an ADR and removal of the marker in the same commit.

## Consequences

Sessions stay short and single-purpose; drift is caught by validators,
sims and the reviewer instead of by memory. The cost is discipline:
schema/skill/validator changes must move together, and no one edits
another agent's surface.
