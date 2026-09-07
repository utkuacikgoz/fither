import { describe, expect, it } from "vitest";
import type { BodyArea } from "../src/index.js";
import { createInitialProfile, generateSession, unblockingAreas } from "../src/index.js";
import { emptyHistory, profileAtTier, prompt, realLibrary } from "./helpers.js";

// The no-session outcome: when today's avoid list empties the pool, the
// engine names which single area, set aside, gives her a session.

const BLOCKING: BodyArea[] = ["shoulders", "core", "hips"];

describe("unblockingAreas", () => {
  it("the blocking triple really generates no blocks", () => {
    const session = generateSession(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      prompt({ avoid: BLOCKING }),
      1,
    );
    expect(session.blocks).toHaveLength(0);
  });

  it("each single removal from the blocking triple unblocks, in prompt order", () => {
    const areas = unblockingAreas(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      prompt({ avoid: BLOCKING }),
      1,
    );
    expect(areas).toStrictEqual(["shoulders", "core", "hips"]);
  });

  it("preserves the order the areas appear in prompt.avoid", () => {
    const areas = unblockingAreas(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      prompt({ avoid: ["hips", "shoulders", "core"] }),
      1,
    );
    expect(areas).toStrictEqual(["hips", "shoulders", "core"]);
  });

  it("returns [] when nothing is blocked (two areas still leave a session)", () => {
    for (const avoid of [
      ["shoulders", "core"],
      ["shoulders", "hips"],
      ["core", "hips"],
    ] as BodyArea[][]) {
      const p = prompt({ avoid });
      expect(
        generateSession(realLibrary, createInitialProfile(), emptyHistory, p, 1).blocks.length,
      ).toBeGreaterThan(0);
      expect(unblockingAreas(realLibrary, createInitialProfile(), emptyHistory, p, 1)).toStrictEqual([]);
    }
  });

  it("returns [] for an unconstrained prompt", () => {
    expect(
      unblockingAreas(realLibrary, createInitialProfile(), emptyHistory, prompt(), 1),
    ).toStrictEqual([]);
  });

  it("excludes an area whose removal alone does not unblock", () => {
    // Setting knees aside still leaves shoulders + core + hips, which empty
    // the pool; each of the other three unblocks on its own.
    const areas = unblockingAreas(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      prompt({ avoid: ["knees", ...BLOCKING] }),
      1,
    );
    expect(areas).toStrictEqual(["shoulders", "core", "hips"]);
    expect(areas).not.toContain("knees");
  });

  it("holds across tiers, budgets and equipment for the blocking triple", () => {
    for (const tier of [1, 3, 6] as const) {
      for (const minutes of [10, 30] as const) {
        for (const equipment of [[], ["chair"]] as const) {
          const areas = unblockingAreas(
            realLibrary,
            profileAtTier(tier),
            emptyHistory,
            prompt({ avoid: BLOCKING, minutes, equipment: [...equipment] }),
            tier * 100 + minutes,
          );
          expect(areas.length).toBeGreaterThan(0);
          for (const area of areas) expect(BLOCKING).toContain(area);
        }
      }
    }
  });

  it("is deterministic and does not mutate the prompt", () => {
    const p = prompt({ avoid: BLOCKING });
    const snapshot = JSON.parse(JSON.stringify(p));
    const a = unblockingAreas(realLibrary, createInitialProfile(), emptyHistory, p, 7);
    const b = unblockingAreas(realLibrary, createInitialProfile(), emptyHistory, p, 7);
    expect(a).toStrictEqual(b);
    expect(p).toStrictEqual(snapshot);
  });
});
