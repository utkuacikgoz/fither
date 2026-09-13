// Copies the recipient page into the live site's checkout (the fither-web
// repository, deployed on Vercel at fither.app). This directory stays the
// source — its tests pin the contract the app relies on — and the site
// repository carries the deployable copy. Run after build-page.mjs:
//
//   node web/scripts/sync-site.mjs [path-to-fither-web]   (default ../fither-web)
//
// What lands where:
//   s/index.html, s/page.css, s/app.js, s/render.mjs, s/content.mjs
//   assets/figures/*.png (added, never removed)
//   .well-known/apple-app-site-association
// The page's /src/ references become /s/ so the files live beside it.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.resolve(process.argv[2] ?? path.join(web, "..", "..", "fither-web"));
if (!existsSync(path.join(target, "index.html"))) {
  console.error(`sync-site: ${target} is not the fither-web checkout (no index.html)`);
  process.exit(1);
}

const out = (...parts) => {
  const file = path.join(target, ...parts);
  mkdirSync(path.dirname(file), { recursive: true });
  return file;
};

// Every pre-rendered page: the generic fallback and one per scenario.
// The page's own /src/ references become /s/ so its modules sit beside
// it in the site repository.
const rewrite = (file) =>
  readFileSync(file, "utf8")
    .replaceAll('"/src/page.css"', '"/s/page.css"')
    .replaceAll('"/src/app.js"', '"/s/app.js"');
writeFileSync(out("s", "index.html"), rewrite(path.join(web, "s", "index.html")));
let pages = 1;
for (const entry of readdirSync(path.join(web, "s"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  writeFileSync(
    out("s", entry.name, "index.html"),
    rewrite(path.join(web, "s", entry.name, "index.html")),
  );
  pages += 1;
}
for (const name of ["page.css", "app.js", "render.mjs", "content.mjs"]) {
  copyFileSync(path.join(web, "src", name), out("s", name));
}
let figures = 0;
for (const name of readdirSync(path.join(web, "assets", "figures"))) {
  if (!name.endsWith(".png")) continue;
  copyFileSync(path.join(web, "assets", "figures", name), out("assets", "figures", name));
  figures += 1;
}
copyFileSync(
  path.join(web, ".well-known", "apple-app-site-association"),
  out(".well-known", "apple-app-site-association"),
);
console.log(
  `sync-site: wrote ${pages} pages plus 4 modules under s/, ${figures} figures and the association file to ${target}`,
);
