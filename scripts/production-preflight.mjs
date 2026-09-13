import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED = Object.freeze([
  "EXPO_PUBLIC_REVENUECAT_IOS_KEY",
  "EXPO_PUBLIC_SENTRY_DSN",
  "EXPO_PUBLIC_POSTHOG_KEY",
  "EXPO_PUBLIC_SHARE_BASE_URL",
  "EXPO_PUBLIC_FEEDBACK_URL",
]);

export function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function validHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username.includes("…");
  } catch {
    return false;
  }
}

export function validateProductionEnvironment(env) {
  const errors = [];
  for (const name of REQUIRED) {
    if (!env[name]) errors.push(`${name} is missing`);
  }
  const revenueCat = env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
  if (revenueCat && !/^appl_[A-Za-z0-9_-]+$/.test(revenueCat)) {
    errors.push("EXPO_PUBLIC_REVENUECAT_IOS_KEY must be a real iOS appl_ key");
  }
  const sentry = env.EXPO_PUBLIC_SENTRY_DSN ?? "";
  if (sentry && (!validHttps(sentry) || !new URL(sentry).username)) {
    errors.push("EXPO_PUBLIC_SENTRY_DSN must be a complete HTTPS DSN");
  }
  const posthog = env.EXPO_PUBLIC_POSTHOG_KEY ?? "";
  if (posthog && !/^phc_[A-Za-z0-9_-]+$/.test(posthog)) {
    errors.push("EXPO_PUBLIC_POSTHOG_KEY must be a real phc_ project key");
  }
  const share = env.EXPO_PUBLIC_SHARE_BASE_URL ?? "";
  if (share && share !== "https://fither.pro") {
    errors.push("EXPO_PUBLIC_SHARE_BASE_URL must be exactly https://fither.pro");
  }
  const feedback = env.EXPO_PUBLIC_FEEDBACK_URL ?? "";
  if (feedback && !validHttps(feedback)) {
    errors.push("EXPO_PUBLIC_FEEDBACK_URL must be a complete HTTPS URL");
  }
  const experiment = env.EXPO_PUBLIC_EXPERIMENT_FREE_SESSIONS;
  if (experiment && !["on", "off"].includes(experiment)) {
    errors.push("EXPO_PUBLIC_EXPERIMENT_FREE_SESSIONS must be on, off, or omitted");
  }
  return errors;
}

const ROUTES = Object.freeze([
  ["home", "https://fither.pro/", "Strength"],
  ["privacy", "https://fither.pro/privacy", "Privacy"],
  ["terms", "https://fither.pro/terms", "Terms"],
  ["shared session", "https://fither.pro/s/session", "Ten minutes. No equipment. Done."],
]);

export async function probeProductionSite(fetchImpl = fetch) {
  const errors = [];
  for (const [name, url, expected] of ROUTES) {
    try {
      const response = await fetchImpl(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status !== 200) {
        errors.push(`${name} returned HTTP ${response.status}; expected 200 without a redirect`);
        continue;
      }
      const body = await response.text();
      if (!body.includes(expected)) errors.push(`${name} does not contain the expected FITHER content`);
      if (name === "shared session" && body.includes("Coming to the App Store.")) {
        errors.push("shared session has no App Store destination");
      }
    } catch {
      errors.push(`${name} could not be reached`);
    }
  }

  try {
    const response = await fetchImpl(
      "https://fither.pro/.well-known/apple-app-site-association",
      { redirect: "manual", signal: AbortSignal.timeout(10_000) },
    );
    if (response.status !== 200) {
      errors.push(`universal-link association returned HTTP ${response.status}; expected 200`);
    } else if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
      errors.push("universal-link association must use application/json");
    } else {
      const association = await response.json();
      const appIds = association?.applinks?.details?.flatMap((item) => item.appIDs ?? []) ?? [];
      if (!appIds.includes("9D78WTZAD8.com.fitherfitness.app")) {
        errors.push("universal-link association does not contain the production app id");
      }
    }
  } catch {
    errors.push("universal-link association could not be read as JSON");
  }
  return errors;
}

async function main() {
  const fileArg = process.argv.indexOf("--env-file");
  const envFile = path.resolve(fileArg >= 0 ? process.argv[fileArg + 1] : "app/.env.production");
  let env;
  try {
    env = parseEnv(await readFile(envFile, "utf8"));
  } catch {
    console.error(`Production preflight failed: ${path.relative(process.cwd(), envFile)} is missing or unreadable`);
    process.exitCode = 1;
    return;
  }

  const environmentErrors = validateProductionEnvironment(env);
  const siteErrors = process.argv.includes("--skip-live") ? [] : await probeProductionSite();
  const errors = [...environmentErrors, ...siteErrors];
  if (errors.length > 0) {
    console.error("Production preflight failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Production preflight OK — ${REQUIRED.length} build values and ${ROUTES.length + 1} public routes verified`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
