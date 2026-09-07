// Writes web/index.html and web/s/index.html from render.mjs. The two
// files are identical: the same page serves at / (generic) and at /s/*
// (scenario read from the path by app.js). Run after any change to
// render.mjs or content.mjs; web/test/page.test.mjs fails on drift.
//
//     node web/scripts/build-page.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderDocument } from "../src/render.mjs";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = renderDocument();
for (const target of ["index.html", path.join("s", "index.html")]) {
  const file = path.join(WEB, target);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, html);
  console.log(file);
}
