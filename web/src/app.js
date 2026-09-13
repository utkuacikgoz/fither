// Recipient page, browser entry. Thin on purpose: the page is rendered by
// the pure functions in render.mjs, which the tests exercise directly.

// The App Store destination now lives in content.mjs, so the served
// HTML and this re-render cannot disagree (2026-09-13).

// OWNER: set this to the page-view collector once one exists. While it is
// empty nothing is sent. When set, one beacon per view carrying only the
// canonical path and the scenario id (docs/measurement.md, "Web
// analytics"): no cookies, no query string, no referrer, no identifiers.
// Add the collector's origin to connect-src in render.mjs at the same
// time, or the CSP blocks it.
const COLLECTOR_URL = "";

import { APP_STORE_URL } from "./content.mjs";
import { canonicalPath, renderPage, scenarioFromPath } from "./render.mjs";

// The path is the only input the page ever reads. The query string and
// the fragment are never touched.
const scenario = scenarioFromPath(window.location.pathname);

const main = document.getElementById("page");
if (main) main.innerHTML = renderPage(scenario, { appStoreUrl: APP_STORE_URL });

if (COLLECTOR_URL && typeof navigator.sendBeacon === "function") {
  const body = JSON.stringify({ path: canonicalPath(scenario), scenario });
  navigator.sendBeacon(COLLECTOR_URL, new Blob([body], { type: "application/json" }));
}
