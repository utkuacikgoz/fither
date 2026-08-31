# ADR-0004: Brief 0 scaffold choices

- Status: accepted
- Date: 2026-08-31

## Context

First code in the repo: the workspace, the engine package skeleton, and
the contract types every agent codes against.

## Decision

1. **pnpm workspace** with `packages/engine` and `app`. Root scripts:
   `test`, `typecheck`, `sim`, `ios`.
2. **Engine tooling**: vitest (unit), tsx (runs `sim/run.ts`), TypeScript
   strict with `noUncheckedIndexedAccess` and
   `exactOptionalPropertyTypes`. All devDependencies — runtime
   dependencies remain zero, per the purity rule.
3. **The contract lives in `packages/engine/src/types.ts`**: movement
   types mirroring movement-schema.md, prompt/profile/history/session
   types, ledger events, and the rule constants from ADR-0002/0003
   (advance at 3, volume-drop at 2 / regress at 3, 7-day pattern absence
   cap, points table). Engine implementation must export
   `generateSession`, `applySessionResult` and `createRng` against these
   types; UI imports only from `@fither/engine`.
4. **Design system**: `fither-code/references/design-system.md` defines
   the premium/calm direction and tokens; `app/src/design/tokens.ts`
   will be their single code home. No raw style values in screens.
5. **Pre-commit hook** (`.githooks/pre-commit`): `pnpm test` always;
   `pnpm sim` when `packages/engine/` or `data/` changed.

## Consequences

Engine and UI agents can build in parallel against a fixed contract.
Changing the contract is a spec change: engine-spec.md / movement-schema.md
and types.ts move together.
