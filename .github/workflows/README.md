# CI

`ci.yml` is the remote half of the safety net described in
`.claude/skills/fither-code/SKILL.md` (Brief 0 checklist) and
`docs/build-system.md` §8. It runs on every push and every pull request.

It mirrors `.githooks/pre-commit`, with two differences, both deliberate:

- The hook skips quietly on a clone with no `node_modules`. CI never skips.
- The hook runs `pnpm sim` only when `packages/engine/` or `data/` changed.
  CI runs it every time — the sim takes about two seconds, so a path filter
  would buy nothing and could let a regression through on a change the filter
  did not anticipate.

The gates, in order, each its own named step so a red run names what broke:

| Step | Command | Guards |
|---|---|---|
| movement library | `node scripts/validate-movements.mjs` | `data/movements.json` integrity, ladders, forbidden-language list |
| release config | `pnpm release:check` | iOS identity/version alignment and isolated EAS profiles |
| typecheck | `pnpm typecheck` | engine + app, TypeScript strict |
| iOS bundle | `pnpm bundle:ios` | Metro can resolve the complete production app graph |
| unit tests | `pnpm test` | vitest (engine) + jest (app) |
| simulation | `pnpm sim` | Gates G1–G5, 500 users × 26 weeks, fixed seed |

The sim's printed G1–G5 numbers are teed into the job log and lifted into the
run's job summary. They are the deliverable — a green tick alone does not tell
you the median week or the utilization band, and the house rule is to report
the actual numbers.

To reproduce a CI failure locally, run the same four commands from the repo
root. Enable the hooks on a fresh clone with
`git config core.hooksPath .githooks`.

## Note on versions

pnpm is not pinned here: `pnpm/action-setup` reads the `packageManager` field
from the root `package.json`, so bumping pnpm there moves CI with it. Node is
pinned to 22 in `ci.yml`.
