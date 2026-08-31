#!/usr/bin/env node
// PostToolUse hook: whenever data/movements.json is written, run the
// integrity validator and feed failures straight back to the agent.
// Exit 2 = blocking feedback (stderr goes to Claude). Anything else is silent.

import { spawnSync } from "node:child_process";

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;

let filePath = "";
try {
  const payload = JSON.parse(input);
  filePath = payload?.tool_input?.file_path ?? "";
} catch {
  process.exit(0);
}

if (!/(^|[\\/])data[\\/]movements\.json$/.test(filePath)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const result = spawnSync("node", ["scripts/validate-movements.mjs"], {
  cwd: root,
  encoding: "utf8",
});

if (result.status !== 0) {
  console.error(
    "movements.json failed validation — fix before doing anything else:\n" +
      (result.stderr || result.stdout || "validator produced no output"),
  );
  process.exit(2);
}
process.exit(0);
