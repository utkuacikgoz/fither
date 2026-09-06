#!/usr/bin/env node
// Integrity gate for data/movements.json.
// Rules live in .claude/skills/fither-domain/references/movement-schema.md —
// this script and that file must never disagree; change them together.
// Zero dependencies on purpose. Exit 0 = valid, exit 1 = violations found.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "data", "movements.json");

// Sync with movement-schema.md (PROPOSED pending Brief 1).
const REQUIRED_PATTERNS = ["push", "pull", "squat", "hinge", "core"];
const EQUIPMENT = new Set(["none", "chair", "wall"]);
const BODY_AREAS = new Set([
  "shoulders", "wrists", "elbows", "back", "hips", "knees", "ankles", "core",
]);
const TIERS = [1, 2, 3, 4, 5, 6];
// The quiet / small-space / no-gear user must keep a full tier 1-4 ladder.
// A wall counts as always available — every home has one; "no gear" means
// nothing you could lack, so the constrained set excludes nothing today.
const CONSTRAINED_EQUIPMENT = new Set(["none", "chair", "wall"]);
const CONSTRAINED_TIERS = [1, 2, 3, 4];

if (!existsSync(dataPath)) {
  console.log("validate-movements: data/movements.json does not exist yet — nothing to validate.");
  process.exit(0);
}

const errors = [];
const err = (msg) => errors.push(msg);

let doc;
try {
  doc = JSON.parse(readFileSync(dataPath, "utf8"));
} catch (e) {
  console.error(`validate-movements: FAIL — not valid JSON: ${e.message}`);
  process.exit(1);
}

const movements = Array.isArray(doc?.movements) ? doc.movements : null;
if (!movements) {
  console.error('validate-movements: FAIL — expected top-level { "version": 1, "movements": [...] }');
  process.exit(1);
}

const byId = new Map();

for (const m of movements) {
  const label = m?.id ?? m?.name ?? "<no id>";

  if (typeof m.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.id))
    err(`${label}: id must be kebab-case`);
  else if (byId.has(m.id)) err(`${label}: duplicate id`);
  else byId.set(m.id, m);

  if (typeof m.name !== "string" || !m.name.trim()) err(`${label}: missing name`);
  if (!REQUIRED_PATTERNS.includes(m.pattern))
    err(`${label}: pattern "${m.pattern}" not in [${REQUIRED_PATTERNS.join(", ")}]`);
  if (!TIERS.includes(m.tier)) err(`${label}: tier must be 1-6, got ${m.tier}`);
  if (typeof m.silent !== "boolean") err(`${label}: silent must be boolean`);
  if (!EQUIPMENT.has(m.equipment))
    err(`${label}: equipment "${m.equipment}" not in [${[...EQUIPMENT].join(", ")}]`);
  if (!Array.isArray(m.loads) || m.loads.some((a) => !BODY_AREAS.has(a)))
    err(`${label}: loads must be an array of known body areas`);
  if (typeof m.unilateral !== "boolean") err(`${label}: unilateral must be boolean`);

  const t = m.timing;
  if (!t || !["reps", "seconds"].includes(t.type) || !(t.defaultValue > 0))
    err(`${label}: timing needs type reps|seconds and defaultValue > 0`);
  else if (t.type === "reps" && !(t.secondsPerRep > 0))
    err(`${label}: timing.secondsPerRep required (and > 0) when type is "reps"`);

  if (!Array.isArray(m.cues) || m.cues.length < 2 || m.cues.length > 4)
    err(`${label}: cues must have 2-4 entries`);

  // Forbidden-language gate (fither-domain): applies to data models too.
  // Substring terms catch compounds ("bodyweight"); word terms avoid
  // false positives ("stone" is fine, "tone up" is not).
  const FORBIDDEN_SUBSTRINGS = /weight|calorie|sculpt|bikini|skinny/i;
  const FORBIDDEN_WORDS = /\b(fat|burn|burns|tone|toned|toning|slim|slimming|crush|shred|shredded)\b/i;
  const texts = [m.id ?? "", m.name ?? "", ...(Array.isArray(m.cues) ? m.cues : [])];
  for (const text of texts) {
    if (FORBIDDEN_SUBSTRINGS.test(text) || FORBIDDEN_WORDS.test(text))
      err(`${label}: forbidden language in "${text}" (see fither-domain forbidden list)`);
  }
}

// Progression graph rules.
for (const m of movements) {
  if (m.tier === 6) {
    if (m.progressionTo !== null)
      err(`${m.id}: tier 6 must have progressionTo: null`);
    continue;
  }
  if (m.progressionTo == null) {
    err(`${m.id}: tier ${m.tier} must have a progressionTo (only tier 6 is terminal)`);
    continue;
  }
  const target = byId.get(m.progressionTo);
  if (!target) {
    err(`${m.id}: progressionTo "${m.progressionTo}" does not resolve`);
    continue;
  }
  if (target.pattern !== m.pattern)
    err(`${m.id}: progressionTo crosses patterns (${m.pattern} -> ${target.pattern})`);
  if (target.tier !== m.tier + 1)
    err(`${m.id}: progressionTo must be exactly tier ${m.tier + 1}, got tier ${target.tier}`);
}

// No orphans: every movement above tier 1 is someone's progressionTo.
const targets = new Set(movements.map((m) => m.progressionTo).filter(Boolean));
for (const m of movements) {
  if (m.tier > 1 && !targets.has(m.id))
    err(`${m.id}: orphan — no lower-tier movement progresses into it`);
}

// Ladder completeness, overall and under the silent + chair + no-gear filter.
for (const pattern of REQUIRED_PATTERNS) {
  const inPattern = movements.filter((m) => m.pattern === pattern);
  for (const tier of TIERS) {
    if (!inPattern.some((m) => m.tier === tier))
      err(`pattern "${pattern}": no movement at tier ${tier} — ladder is broken`);
  }
  const constrained = inPattern.filter(
    (m) => m.silent === true && CONSTRAINED_EQUIPMENT.has(m.equipment),
  );
  for (const tier of CONSTRAINED_TIERS) {
    if (!constrained.some((m) => m.tier === tier))
      err(`pattern "${pattern}": silent+chair+no-gear filter loses tier ${tier} — the quiet user has no session`);
  }
}

if (errors.length) {
  console.error(`validate-movements: FAIL — ${errors.length} violation(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `validate-movements: OK — ${movements.length} movements, patterns [${REQUIRED_PATTERNS.join(", ")}], ladders complete, constrained ladders (tiers 1-4) intact.`,
);
