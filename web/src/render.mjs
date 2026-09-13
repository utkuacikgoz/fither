// Pure rendering for the recipient page. No DOM, no IO, no globals: the
// browser entry (app.js) and the tests both call these functions.
//
// Safety contract:
//  - The only thing ever read back into the page is a key of SCENARIOS.
//    Any other input (unknown id, traversal, markup, a long string,
//    nothing at all) resolves to null and renders the generic page. The
//    input itself never reaches the output.
//  - Every string is HTML-escaped on the way out, even though the copy is
//    static; the renderer must be safe regardless of what content.mjs
//    holds.
//  - The button's only destination is the owner's App Store URL. While
//    that is empty there is no button and no stand-in link.

import {
  COMING,
  FACTS,
  FIGURES,
  FINE_PRINT,
  GENERIC,
  SCENARIOS,
} from "./content.mjs";

export const SCENARIO_IDS = Object.freeze(Object.keys(SCENARIOS));
const ALLOWLIST = new Set(SCENARIO_IDS);
const FIGURE_SET = new Set(FIGURES);

// A scenario id or null. Exact, case-sensitive membership; nothing else.
export function resolveScenario(input) {
  return typeof input === "string" && ALLOWLIST.has(input) ? input : null;
}

// `/s/<id>` or `/s/<id>/` to a scenario id, else null. Only lowercase
// letters and underscores are even considered, so the regex never
// captures traversal, encoded bytes or markup; the capture is then
// checked against the allowlist, so only an allowlisted id is returned.
const PATH = /^\/s\/([a-z_]{1,32})\/?$/;
export function scenarioFromPath(pathname) {
  if (typeof pathname !== "string" || pathname.length > 64) return null;
  const match = PATH.exec(pathname);
  return match ? resolveScenario(match[1]) : null;
}

// The canonical path for the beacon: derived from the resolved id, never
// from what the browser reported.
export function canonicalPath(scenario) {
  const id = resolveScenario(scenario);
  return id ? `/s/${id}` : "/";
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// The App Store URL is trusted only if it is an https URL on Apple's
// store host. Anything else is treated as unset.
export function storeUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^https:\/\/apps\.apple\.com\/[^\s"'<>]+$/.test(trimmed) ? trimmed : "";
}

export function contentFor(scenario) {
  const id = resolveScenario(scenario);
  return id ? SCENARIOS[id] : GENERIC;
}

function figureClass(figure) {
  return FIGURE_SET.has(figure) ? `fig fig-${figure}` : "fig";
}

// Inner HTML of <main id="page">.
export function renderPage(scenario, options = {}) {
  const content = contentFor(scenario);
  const url = storeUrl(options.appStoreUrl);
  const parts = [];

  parts.push(
    '<header class="brand"><span class="mark" aria-hidden="true"></span>' +
      '<span class="wm">FITHER</span></header>',
  );

  parts.push('<section class="scene">');
  if (content.caption) {
    parts.push(`<p class="caption">${escapeHtml(content.caption)}</p>`);
  }
  parts.push(`<h1 class="display">${escapeHtml(content.headline)}</h1>`);
  parts.push("</section>");

  parts.push(
    `<div class="${figureClass(content.figure)}" aria-hidden="true"></div>`,
  );

  parts.push(`<p class="line">${escapeHtml(content.line)}</p>`);

  parts.push('<ul class="facts">');
  for (const fact of FACTS) parts.push(`<li>${escapeHtml(fact)}</li>`);
  parts.push("</ul>");

  parts.push('<div class="bottom">');
  if (url) {
    parts.push(
      `<a class="btn" href="${escapeHtml(url)}" rel="noopener">` +
        `${escapeHtml(content.button)}</a>`,
    );
    parts.push(`<p class="fine">${escapeHtml(FINE_PRINT)}</p>`);
  } else {
    parts.push(`<p class="coming">${escapeHtml(COMING)}</p>`);
  }
  if (content.consent) {
    parts.push(`<p class="fine consent">${escapeHtml(content.consent)}</p>`);
  }
  parts.push("</div>");

  return parts.join("\n");
}

// The whole static document. Both web/index.html and web/s/index.html are
// this, pre-rendered generic; app.js swaps in the scenario on the phone.
// Asset paths are root-absolute so the same file serves at / and /s/*.
/**
 * The whole document for ONE scenario, or the generic page for null.
 *
 * Every scenario is pre-rendered to its own file (scripts/build-page.mjs)
 * rather than swapped in by the browser. A shared link is read by things
 * that never run JavaScript — the production preflight, link previews,
 * a reader with scripting off — and all of them were being served the
 * generic page while the recipient saw the scenario (found 2026-09-13,
 * when the preflight asked /s/session for its own headline and did not
 * find it). app.js still renders on load; it now agrees with the HTML
 * it finds instead of replacing it.
 */
export function renderDocument(options = {}) {
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    '<meta name="referrer" content="no-referrer">',
    '<meta name="color-scheme" content="dark">',
    '<meta name="theme-color" content="#0B0F0C">',
    "<title>FITHER</title>",
    '<link rel="icon" href="/assets/mark.png">',
    '<link rel="stylesheet" href="/src/page.css">',
    "</head>",
    "<body>",
    '<main id="page">',
    renderPage(options.scenario ?? null, options),
    "</main>",
    '<script type="module" src="/src/app.js"></script>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
