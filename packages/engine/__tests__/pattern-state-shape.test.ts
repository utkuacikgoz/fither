import { describe, expect, it } from "vitest";
import { applySessionResult, createInitialProfile } from "../src/index.js";
import { emptyHistory, realLibrary } from "./helpers.js";

/**
 * Shape regression guard for the S2 rename: the progression counters are
 * `cleanCount` / `struggleCount` — internal bookkeeping of consecutive
 * clean/struggled sessions at the current tier. The pre-rename `*Streak`
 * names must never reappear ("streak" is forbidden-list-adjacent, even
 * internally). This pins the persisted PatternState key set the app
 * stores on device; renames here require an app-side migration.
 */
describe("PatternState shape (S2 rename guard)", () => {
  it("fresh profiles carry cleanCount/struggleCount and no *Streak keys", () => {
    const profile = createInitialProfile();
    for (const state of Object.values(profile.patterns)) {
      expect(Object.keys(state).sort()).toStrictEqual([
        "cleanCount",
        "struggleCount",
        "tier",
        "volumeReduced",
      ]);
      expect(state).not.toHaveProperty("cleanStreak");
      expect(state).not.toHaveProperty("struggledStreak");
    }
  });

  it("applied states keep the renamed keys and never grow *Streak keys", () => {
    const profile = createInitialProfile();
    const movement = realLibrary.movements.find(
      (m) => m.pattern === "push" && m.tier === 1,
    );
    if (!movement) throw new Error("no push movement at tier 1");
    const result = applySessionResult(realLibrary, profile, emptyHistory, {
      session: {
        date: "2026-02-02",
        minutes: 20,
        blocks: [
          {
            movementId: movement.id,
            pattern: "push",
            sets: 3,
            amount: 8,
            restSeconds: 45,
            estimatedSeconds: 200,
            atNewTier: false,
          },
        ],
        estimatedTotalSeconds: 200,
        seed: 1,
        adaptations: [],
      },
      outcomes: ["completed"],
    });
    const push = result.profile.patterns.push;
    expect(push.cleanCount).toBe(1);
    expect(push.struggleCount).toBe(0);
    // `earnedTier` joins the persisted set with ADR-0026: the tier the
    // ordinary progression gave her, which regression may never cross.
    // Optional on read (absent = the current tier), always stamped on
    // write — so an app-side profile persisted without it loses nothing.
    expect(Object.keys(push).sort()).toStrictEqual([
      "cleanCount",
      "earnedTier",
      "struggleCount",
      "tier",
      "tierSince",
      "volumeReduced",
    ]);
    expect(push.earnedTier).toBe(1);
    expect(push).not.toHaveProperty("cleanStreak");
    expect(push).not.toHaveProperty("struggledStreak");
  });
});
