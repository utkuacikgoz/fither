# data/

`movements.json` — the 60-movement library, source of truth for the whole
product. Created and edited ONLY by the movement-author agent; schema and
integrity rules in
`.claude/skills/fither-domain/references/movement-schema.md`; validated by
`node scripts/validate-movements.mjs` (runs automatically on every edit via
the PostToolUse hook).

Not yet created — that is the movement-author's first session (Phase 1).
