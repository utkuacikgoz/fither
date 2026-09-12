import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseEnv,
  probeProductionSite,
  validateProductionEnvironment,
} from "../production-preflight.mjs";

const validEnv = {
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: "appl_live123",
  EXPO_PUBLIC_SENTRY_DSN: "https://public@o1.ingest.sentry.io/1",
  EXPO_PUBLIC_POSTHOG_KEY: "phc_live123",
  EXPO_PUBLIC_SHARE_BASE_URL: "https://fither.app",
  EXPO_PUBLIC_FEEDBACK_URL: "https://forms.example.com/f/fither",
  EXPO_PUBLIC_EXPERIMENT_FREE_SESSIONS: "off",
};

test("parses unquoted, quoted, and exported env values without interpolation", () => {
  assert.deepEqual(
    parseEnv('A=one\nB="two"\nexport C=\'three\'\n# D=four\nINVALID LINE\n'),
    { A: "one", B: "two", C: "three" },
  );
});

test("accepts the complete production environment", () => {
  assert.deepEqual(validateProductionEnvironment(validEnv), []);
});

test("rejects missing adapters, test store keys, placeholders, and wrong share hosts", () => {
  const errors = validateProductionEnvironment({
    EXPO_PUBLIC_REVENUECAT_IOS_KEY: "test_store",
    EXPO_PUBLIC_SENTRY_DSN: "https://…@….ingest.sentry.io/…",
    EXPO_PUBLIC_POSTHOG_KEY: "project-key",
    EXPO_PUBLIC_SHARE_BASE_URL: "https://staging.fither.app",
    EXPO_PUBLIC_FEEDBACK_URL: "http://forms.example.com/f/fither",
    EXPO_PUBLIC_EXPERIMENT_FREE_SESSIONS: "true",
  });
  assert.equal(errors.length, 6);
  assert.ok(errors.some((error) => error.includes("appl_")));
  assert.ok(errors.some((error) => error.includes("exactly https://fither.app")));
});

test("checks first-party pages, the recipient handoff, and the association file", async () => {
  const fetchOk = async (url) => {
    if (url.endsWith("apple-app-site-association")) {
      return new Response(
        JSON.stringify({
          applinks: { details: [{ appIDs: ["9D78WTZAD8.com.fitherfitness.app"] }] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    const text = url.endsWith("/privacy")
      ? "FITHER Privacy"
      : url.endsWith("/terms")
        ? "FITHER Terms"
        : url.endsWith("/s/session")
          ? "Ten minutes. No equipment. Done. Get FITHER"
          : "Strength that fits your life";
    return new Response(text, { status: 200 });
  };
  assert.deepEqual(await probeProductionSite(fetchOk), []);
});

test("fails redirects, parked content, missing store destination, and invalid association JSON", async () => {
  const broken = async (url) => {
    if (url.endsWith("apple-app-site-association")) {
      return new Response("<html>parked</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url.endsWith("/privacy")) return new Response("", { status: 307 });
    if (url.endsWith("/s/session")) {
      return new Response("Ten minutes. No equipment. Done. Coming to the App Store.");
    }
    return new Response("parked", { status: 200 });
  };
  const errors = await probeProductionSite(broken);
  assert.ok(errors.some((error) => error.includes("privacy returned HTTP 307")));
  assert.ok(errors.some((error) => error.includes("expected FITHER content")));
  assert.ok(errors.some((error) => error.includes("no App Store destination")));
  assert.ok(errors.some((error) => error.includes("application/json")));
});
