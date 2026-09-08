import { ANALYTICS_EVENT_NAMES } from "../events";

// The app's tsconfig carries no node types (nothing in the app may use
// them); this one test reads source files, so it names what it needs.
declare const __dirname: string;
const { readFileSync, readdirSync } = jest.requireActual("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
};
const { join } = jest.requireActual("node:path") as { join(...parts: string[]): string };

// The forbidden list (fither-domain) applied to analytics: the words
// must not appear anywhere in the analytics module, so no event or
// property can carry them even by accident. Scanned as source, comments
// included — a comment is where the next property gets planned.
const FORBIDDEN = /weight|calorie|kcal|fat\b|slim|tone[ds]?\b|bikini|body[- ]?(shape|goal)/i;

describe("analytics events", () => {
  it("are exactly the funnel the retention thesis needs (ADR-0015, ADR-0024)", () => {
    expect([...ANALYTICS_EVENT_NAMES]).toEqual([
      "deep_link_open",
      "first_use_entry",
      "onboarding_complete",
      "session_preview",
      "workout_start",
      "workout_complete",
      "weekly_intention_set",
      "share_eligible",
      "share_start",
      "paywall_view",
      "scenario_entry",
      "experiment_exposure",
      "trial_start",
      // Drop-off pass (2026-09-08): where she leaves, step by step.
      "sign_in_view",
      "sign_in_result",
      "prompt_answer",
      "no_session_shown",
      "no_session_action",
      "care_note",
      "preview_leave",
      "voice_ask",
      "block_outcome",
      "skill_unlocked",
      "reminder_ask",
      "paywall_plan",
      "paywall_leave",
      "purchase_result",
      "restore_result",
      "lifetime_offer",
      "share_complete",
      "account_action",
    ]);
  });

  it("cannot represent anything on the forbidden list", () => {
    const dir = join(__dirname, "..");
    const sources = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(sources.length).toBeGreaterThan(3);
    for (const file of sources) {
      const text = readFileSync(join(dir, file), "utf8");
      const hit = FORBIDDEN.exec(text);
      expect(hit ? `${file}: "${hit[0]}"` : null).toBeNull();
    }
  });
});
