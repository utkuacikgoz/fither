// Writes the recipient page: the generic one at web/index.html and
// web/s/index.html, and ONE pre-rendered file per allowlisted scenario
// at web/s/<id>/index.html. Run after any change to render.mjs or
// content.mjs; web/test/page.test.mjs fails on drift.
//
// Why a file per scenario, and not the browser swapping content in: a
// shared link is read by things that never run JavaScript (the
// production preflight, link previews, scripting-off readers), and they
// were all being served the generic page while the recipient saw the
// scenario.
//
//     node web/scripts/build-page.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCENARIOS } from "../src/content.mjs";
import { renderDocument } from "../src/render.mjs";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function write(target, html) {
  const file = path.join(WEB, target);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, html);
  console.log(file);
}

// The generic page, served at / and as the fallback for an unknown id.
const generic = renderDocument();
write("index.html", generic);
write(path.join("s", "index.html"), generic);

for (const scenario of Object.keys(SCENARIOS)) {
  write(path.join("s", scenario, "index.html"), renderDocument({ scenario }));
}
