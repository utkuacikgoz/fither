// Recipient page tests. Run with `pnpm web:test` (node --test web/test/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCENARIO_IDS,
  canonicalPath,
  escapeHtml,
  renderDocument,
  renderPage,
  resolveScenario,
  scenarioFromPath,
  storeUrl,
} from "../src/render.mjs";
import {
  APP_STORE_URL,
  COMING,
  FACTS,
  FIGURES,
  FINE_PRINT,
  GENERIC,
  SCENARIOS,
} from "../src/content.mjs";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(WEB, rel), "utf8");

const STORE = "https://apps.apple.com/app/id0000000000";
const ALLOWLIST = [
  "friends_week",
  "between_meetings",
  "away_from_home",
  "quiet_house",
  "session",
  "week",
];
const CUT_SENTENCE = "Yours would be built for yours";

const MALFORMED = [
  "../x",
  "..%2F..%2Fetc%2Fpasswd",
  "<script>alert(1)</script>",
  '"><img src=x onerror=alert(1)>',
  "x".repeat(300),
  "friends_week ",
  "FRIENDS_WEEK",
  "friends-week",
  "friends_week/../session",
  "session?utm=1",
  "week#x",
  "",
];

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walk(file, out);
    else out.push(file);
  }
  return out;
};

test("allowlist is exactly the six scenario ids", () => {
  assert.deepEqual([...SCENARIO_IDS].sort(), [...ALLOWLIST].sort());
  for (const id of ALLOWLIST) assert.equal(resolveScenario(id), id);
});

test("each allowlisted scenario renders its headline, line and button", () => {
  for (const id of ALLOWLIST) {
    const c = SCENARIOS[id];
    const html = renderPage(id, { appStoreUrl: STORE });
    assert.ok(html.includes(`<h1 class="display">${escapeHtml(c.headline)}</h1>`), id);
    assert.ok(html.includes(escapeHtml(c.line)), `${id} line`);
    assert.ok(html.includes(`>${escapeHtml(c.button)}</a>`), `${id} button`);
    if (c.caption) assert.ok(html.includes(escapeHtml(c.caption)), `${id} caption`);
    assert.ok(html.includes(`class="fig fig-${c.figure}"`), `${id} figure`);
    for (const fact of FACTS) assert.ok(html.includes(escapeHtml(fact)), `${id} fact`);
    assert.ok(html.includes(escapeHtml(FINE_PRINT)), `${id} fine print`);
    assert.ok(html.includes('class="wm">FITHER<'), `${id} wordmark`);
    assert.ok(!html.includes(GENERIC.headline) || c.headline === GENERIC.headline, id);
    assert.ok(!html.includes(CUT_SENTENCE), `${id} carries the cut sentence`);
  }
});

test("scenario headlines match the briefs", () => {
  assert.equal(SCENARIOS.friends_week.headline, "Three sessions this week, with a friend.");
  assert.equal(SCENARIOS.between_meetings.headline, "Ten minutes between meetings.");
  assert.equal(SCENARIOS.away_from_home.headline, "Just you and the floor.");
  assert.equal(SCENARIOS.quiet_house.headline, "Every movement stays quiet.");
  assert.equal(SCENARIOS.between_meetings.button, "Try 10 minutes");
  assert.equal(SCENARIOS.away_from_home.button, "Try 20 minutes");
  assert.equal(SCENARIOS.quiet_house.button, "Try a quiet session");
  assert.equal(SCENARIOS.friends_week.button, "Try your first session");
  assert.equal(
    SCENARIOS.session.line,
    "A friend just finished a session built for the room she was in.",
  );
  assert.ok(SCENARIOS.friends_week.consent.startsWith("A friend sent you this."));
  for (const id of ALLOWLIST) {
    if (id !== "friends_week") assert.equal(SCENARIOS[id].consent, undefined, id);
  }
});

test("unknown and malformed input renders the generic page and never echoes the input", () => {
  const generic = `<h1 class="display">${escapeHtml(GENERIC.headline)}</h1>`;
  const inputs = [...MALFORMED, undefined, null, 42, {}, [], ["friends_week"]];
  for (const input of inputs) {
    assert.equal(resolveScenario(input), null, String(input));
    const renders = [
      renderPage(resolveScenario(input), { appStoreUrl: STORE }),
      renderPage(input, { appStoreUrl: STORE }),
      renderPage(scenarioFromPath(input), { appStoreUrl: STORE }),
    ];
    // Only a string can arrive as a path segment; non-strings are covered
    // above and would stringify into something else inside the template.
    if (typeof input === "string") {
      renders.push(renderPage(scenarioFromPath(`/s/${input}`), { appStoreUrl: STORE }));
    }
    for (const html of renders) {
      assert.ok(html.includes(generic), `generic for ${String(input)}`);
      if (typeof input === "string" && input.length > 0) {
        assert.ok(!html.includes(input), `echoed ${input}`);
        assert.ok(!html.includes(escapeHtml(input)), `echoed (escaped) ${input}`);
      }
      assert.ok(!/<script/i.test(html), "script tag in output");
      assert.ok(!html.includes("onerror"), "handler in output");
    }
  }
});

test("path parsing accepts only /s/<allowlisted id>", () => {
  for (const id of ALLOWLIST) {
    assert.equal(scenarioFromPath(`/s/${id}`), id);
    assert.equal(scenarioFromPath(`/s/${id}/`), id);
    assert.equal(canonicalPath(id), `/s/${id}`);
  }
  const rejected = [
    "/",
    "/s",
    "/s/",
    "/index.html",
    "/s/index.html",
    "/s/friends_week/x",
    "/s/friends_week/../session",
    "/s/FRIENDS_WEEK",
    "/s/friends_week?x=1",
    "/s/friends_week#x",
    "/x/friends_week",
    "/s/friends_week%2F..",
    "//s/friends_week",
    "s/friends_week",
    `/s/${"a".repeat(300)}`,
    "",
    undefined,
    null,
  ];
  for (const p of rejected) {
    assert.equal(scenarioFromPath(p), null, String(p));
    assert.equal(canonicalPath(scenarioFromPath(p)), "/", String(p));
  }
});

test("button is the owner's App Store URL or nothing", () => {
  const empty = renderPage("session", { appStoreUrl: "" });
  assert.ok(!empty.includes("<a "), "button rendered without a URL");
  assert.ok(!empty.includes("href="), "href rendered without a URL");
  assert.ok(empty.includes(escapeHtml(COMING)));
  assert.ok(!empty.includes(escapeHtml(FINE_PRINT)));

  const unset = renderPage("session");
  assert.ok(!unset.includes("<a "));

  const withUrl = renderPage("session", { appStoreUrl: STORE });
  assert.ok(withUrl.includes(`<a class="btn" href="${STORE}" rel="noopener">`));
  assert.ok(!withUrl.includes(escapeHtml(COMING)));

  for (const bad of [
    "javascript:alert(1)",
    "http://apps.apple.com/app/id1",
    "https://example.com/app",
    "https://apps.apple.com.evil.example/app",
    "#",
    "/s/session",
    42,
    null,
  ]) {
    assert.equal(storeUrl(bad), "", String(bad));
    const html = renderPage("session", { appStoreUrl: bad });
    assert.ok(!html.includes("href="), `fake destination for ${String(bad)}`);
  }
  for (const id of [...ALLOWLIST, null]) {
    assert.ok(!renderPage(id, { appStoreUrl: STORE }).includes('href="#'));
  }
});

test("association file is valid JSON for com.fitherfitness.app on /s/*", () => {
  const raw = read(path.join(".well-known", "apple-app-site-association"));
  const json = JSON.parse(raw);
  const details = json.applinks.details;
  assert.ok(Array.isArray(details) && details.length === 1);
  const [entry] = details;
  assert.equal(entry.appIDs.length, 1);
  assert.ok(entry.appIDs[0].endsWith(".com.fitherfitness.app"), entry.appIDs[0]);
  assert.equal(entry.appIDs[0], "9D78WTZAD8.com.fitherfitness.app", "the registered team and bundle id");
  assert.ok(entry.components.some((c) => c["/"] === "/s/*"));
  assert.ok(!raw.includes("http"), "no hosts in the association file");
});

test("index.html and s/index.html are the same pre-rendered generic page", () => {
  const root = read("index.html");
  const nested = read(path.join("s", "index.html"));
  assert.equal(root, nested);
  assert.equal(
    root,
    renderDocument({ appStoreUrl: APP_STORE_URL }),
    "run node web/scripts/build-page.mjs",
  );
  assert.ok(root.includes('<main id="page">'));
  assert.ok(root.includes(escapeHtml(GENERIC.headline)));
  assert.ok(root.includes('<script type="module" src="/src/app.js"></script>'));
  assert.ok(root.includes('<link rel="stylesheet" href="/src/page.css">'));
  assert.ok(root.includes('http-equiv="Content-Security-Policy"'));
  assert.ok(root.includes('<meta name="referrer" content="no-referrer">'));
  assert.ok(!root.includes(CUT_SENTENCE));
});

test("browser entry reads the path only and holds the owner's constants", () => {
  const js = read(path.join("src", "app.js"));
  // The destination moved to content.mjs (2026-09-13) so the served HTML
  // and this re-render cannot disagree; app.js must read it, never hold
  // its own copy.
  assert.match(js, /^import \{ APP_STORE_URL \} from "\.\/content\.mjs";$/m);
  assert.ok(!/^const APP_STORE_URL = /m.test(js), "app.js must not keep a second copy");
  assert.match(js, /^const COLLECTOR_URL = "";$/m, "collector off until one exists");
  // The collector is still a constant the owner edits in place, so it
  // stays above the imports where they will find it.
  assert.ok(
    js.indexOf("COLLECTOR_URL") < js.indexOf("import "),
    "the owner's own constant stays at the top",
  );
  for (const banned of [
    "location.search",
    "location.hash",
    "location.href",
    "document.cookie",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "document.referrer",
    "navigator.userAgent",
    "fetch(",
    "XMLHttpRequest",
    "innerHTML = window",
  ]) {
    assert.ok(!js.includes(banned), `app.js uses ${banned}`);
  }
  assert.ok(js.includes("scenarioFromPath(window.location.pathname)"));
});

test("no HTML, CSS or JS in web/ references an external host", () => {
  const files = walk(WEB).filter((f) => /\.(html|css|js|mjs)$/.test(f));
  assert.ok(files.length >= 6, "expected page, styles, scripts and tests");
  const host = /(?:https?:)?\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+/i;
  for (const file of files) {
    const lines = read(path.relative(WEB, file)).split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // Comments and the two owner constants in app.js may name Apple's
      // store or the owner's collector; nothing else may name any host.
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      if (/^const (APP_STORE_URL|COLLECTOR_URL) = /.test(trimmed)) return;
      // The one App Store destination, and the pages built from it: the
      // link is the point of the page, and storeUrl() already refuses
      // anything that is not an apps.apple.com URL.
      if (/^export const APP_STORE_URL = /.test(trimmed)) return;
      if (/https:\/\/apps\.apple\.com\//.test(trimmed)) return;
      if (file.endsWith("page.test.mjs")) return;
      assert.ok(!host.test(line), `${path.relative(WEB, file)}:${i + 1} references a host: ${trimmed}`);
    });
  }
  // The one destination, wherever it now lives, must survive storeUrl:
  // anything that is not an apps.apple.com URL is treated as unset and
  // the page silently falls back to COMING.
  assert.equal(storeUrl(APP_STORE_URL), APP_STORE_URL);
});

test("copy passes the voice filter: no dashes, nothing forbidden", () => {
  const forbidden = [
    /weigh/i, /calorie/i, /\bburn/i, /\bfat\b/i, /slim/i, /skinny/i,
    /streak/i, /don'?t break/i, /miss you/i, /lose your progress/i,
    /\btone\b/i, /sculpt/i, /bikini/i, /problem area/i, /no excuses/i,
    /what'?s stopping/i, /guilt/i, /\bquick\b/i, /\bmini\b/i, /crush/i,
    /beast/i, /shred/i, /transform/i, /before\s*(and|\/)\s*after/i,
  ];
  const outputs = [...ALLOWLIST, null].flatMap((id) => [
    renderPage(id, { appStoreUrl: STORE }),
    renderPage(id),
  ]);
  for (const html of outputs) {
    assert.ok(!/[–—]/.test(html), "dash in copy");
    for (const rule of forbidden) assert.ok(!rule.test(html), `${rule} in copy`);
    assert.ok(!html.includes(CUT_SENTENCE));
  }
  assert.ok(!/[–—]/.test(read(path.join("src", "content.mjs"))));
});

test("every figure the copy names exists as a masked asset and a class", () => {
  const css = read(path.join("src", "page.css"));
  const named = new Set([GENERIC.figure, ...ALLOWLIST.map((id) => SCENARIOS[id].figure)]);
  for (const figure of named) {
    assert.ok(FIGURES.includes(figure), figure);
    assert.ok(existsSync(path.join(WEB, "assets", "figures", `${figure}.png`)), figure);
    assert.ok(css.includes(`.fig-${figure} {`), `class for ${figure}`);
  }
  assert.ok(existsSync(path.join(WEB, "assets", "mark.png")));
  for (const weight of ["400Regular", "500Medium", "600SemiBold", "700Bold"]) {
    assert.ok(existsSync(path.join(WEB, "assets", "fonts", `Manrope_${weight}.ttf`)), weight);
  }
  assert.ok(!/url\((?!["']?\/assets\/)/.test(css), "css urls must be root-relative to /assets/");
  assert.ok((css.match(/url\(/g) || []).length >= 12, "expected font, mark and figure urls");
});

// Pre-rendered scenarios (2026-09-13). A shared link is read by things
// that never run JavaScript; every one of them was getting the generic
// page while the recipient saw the scenario.
test("every allowlisted scenario has its own pre-rendered page", () => {
  for (const [id, content] of Object.entries(SCENARIOS)) {
    const html = read(path.join("s", id, "index.html"));
    assert.ok(
      html.includes(escapeHtml(content.headline)),
      `${id}: the served HTML must carry its own headline`,
    );
    // Not the button: it is replaced by COMING until the App Store URL
    // is set, so the line is what proves the scenario reached the HTML.
    assert.ok(html.includes(escapeHtml(content.line)), `${id}: and its own line`);
  }
});

test("the generic page is still what an unknown scenario falls back to", () => {
  const generic = read(path.join("s", "index.html"));
  assert.ok(generic.includes(escapeHtml(GENERIC.headline)));
  for (const content of Object.values(SCENARIOS)) {
    if (content.headline === GENERIC.headline) continue;
    assert.ok(
      !generic.includes(escapeHtml(content.headline)),
      "the fallback page must not leak a scenario's copy",
    );
  }
});
