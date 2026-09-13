// deep_link_open, the one event with an input to clean. A link's path is
// the only thing worth knowing ("which link brought her in"); the query
// and fragment are dropped unread because that is where tokens and
// identifiers live. The dev client's own launch URLs are not deep links
// and are ignored.

import { useLinkingURL } from "expo-linking";
import { useEffect, useRef } from "react";

import { track } from "./analytics";
import { SCENARIO_IDS, type ScenarioId } from "./events";

const DEV_CLIENT_HOST = "expo-development-client";

/**
 * The trackable path of an incoming URL, or null when the URL is not a
 * deep link worth counting. Pure, so the rule is testable on its own.
 *   fither://unlock?x=1      → "/unlock"
 *   https://fither.pro/today → "/today"
 *   fither://                → "/"
 */
export function deepLinkPath(url: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/i.exec(url);
  if (!match) return null;
  const scheme = match[1] ?? "";
  const host = match[2] ?? "";
  const path = match[3] ?? "";
  if (scheme.startsWith("exp") || host === DEV_CLIENT_HOST) return null;
  const isWeb = scheme === "http" || scheme === "https";
  // Custom scheme: the "host" is really the first path segment.
  const full = isWeb ? path : `/${host}${path}`;
  const trimmed = full.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/**
 * The allowlisted scenario a shared link carries (`/s/<id>`), or null.
 * Unknown, malformed or over-long ids are dropped, never forwarded.
 */
export function scenarioFromPath(path: string): ScenarioId | null {
  const match = /^\/s\/([a-z_]{1,32})$/.exec(path);
  const id = match?.[1];
  return id !== undefined && (SCENARIO_IDS as readonly string[]).includes(id)
    ? (id as ScenarioId)
    : null;
}

/**
 * Mount once at the root. Fires deep_link_open for the launch URL and for
 * every URL that arrives while the app is open — each distinct URL once.
 */
export function useDeepLinkTracking(): void {
  const url = useLinkingURL();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!url || url === last.current) return;
    last.current = url;
    const path = deepLinkPath(url);
    if (path === null) return;
    track("deep_link_open", { path });
    // scenario_entry (ADR-0024 §3): the id only, and only from the list.
    const scenario = scenarioFromPath(path);
    if (scenario !== null) track("scenario_entry", { scenario });
  }, [url]);
}
