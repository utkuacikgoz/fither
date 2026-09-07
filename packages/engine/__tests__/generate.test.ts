import { describe, expect, it } from "vitest";
import type {
  BodyArea,
  Energy,
  SessionMinutes,
  Tier,
} from "../src/index.js";
import {
  createInitialProfile,
  generateSession,
  PATTERNS,
  TARGET_UTILIZATION,
} from "../src/index.js";
import { maxBlocksPerPattern } from "../src/generate.js";
import {
  emptyHistory,
  historyWithPatterns,
  profileAtTier,
  prompt,
  realLibrary,
  syntheticLibrary,
} from "./helpers.js";

const movementById = new Map(realLibrary.movements.map((m) => [m.id, m]));

describe("generateSession — determinism", () => {
  it("same inputs and seed produce an identical session, bit for bit", () => {
    const p = prompt({ minutes: 30, energy: "strong" });
    const a = generateSession(realLibrary, profileAtTier(3), emptyHistory, p, 42);
    const b = generateSession(realLibrary, profileAtTier(3), emptyHistory, p, 42);
    expect(a).toStrictEqual(b);
  });

  it("does not mutate its inputs", () => {
    const profile = profileAtTier(2);
    const snapshot = JSON.parse(JSON.stringify(profile));
    generateSession(realLibrary, profile, emptyHistory, prompt(), 7);
    expect(profile).toStrictEqual(snapshot);
  });
});

describe("generateSession — time budget (property sweep)", () => {
  const minutesOptions: SessionMinutes[] = [10, 20, 30];
  const energies: Energy[] = ["low", "okay", "strong"];
  const avoids: BodyArea[][] = [[], ["shoulders"], ["knees"], ["wrists"]];
  const tiers: Tier[] = [1, 2, 3, 4, 5, 6];

  it("never exceeds the budget and fills at least 90% of it", () => {
    let seed = 1;
    for (const minutes of minutesOptions) {
      for (const energy of energies) {
        for (const quiet of [false, true]) {
          for (const avoid of avoids) {
            for (const tier of tiers) {
              const session = generateSession(
                realLibrary,
                profileAtTier(tier),
                emptyHistory,
                prompt({ minutes, energy, quiet, avoid }),
                seed++,
              );
              const budget = minutes * 60;
              expect(session.estimatedTotalSeconds).toBeLessThanOrEqual(budget);
              expect(session.estimatedTotalSeconds).toBeGreaterThanOrEqual(
                budget * TARGET_UTILIZATION,
              );
              // Block estimates must honestly sum to the total.
              const sum = session.blocks.reduce(
                (acc, b) => acc + b.estimatedSeconds,
                0,
              );
              expect(sum).toBe(session.estimatedTotalSeconds);
            }
          }
        }
      }
    }
  });
});

describe("generateSession — constraint filtering", () => {
  it("quiet keeps only silent movements", () => {
    const lib = syntheticLibrary();
    const session = generateSession(
      lib,
      createInitialProfile(),
      emptyHistory,
      prompt({ quiet: true }),
      3,
    );
    const byId = new Map(lib.movements.map((m) => [m.id, m]));
    expect(session.blocks.length).toBeGreaterThan(0);
    for (const b of session.blocks) {
      expect(byId.get(b.movementId)?.silent).toBe(true);
    }
  });

  it("excludes equipment the user lacks (wall always available)", () => {
    const lib = syntheticLibrary();
    const session = generateSession(
      lib,
      createInitialProfile(),
      emptyHistory,
      prompt({ equipment: [] }),
      3,
    );
    const byId = new Map(lib.movements.map((m) => [m.id, m]));
    for (const b of session.blocks) {
      const eq = byId.get(b.movementId)?.equipment;
      expect(eq === "none" || eq === "wall").toBe(true);
    }
  });

  it("avoid areas exclude movements loading them", () => {
    const session = generateSession(
      realLibrary,
      profileAtTier(2),
      emptyHistory,
      prompt({ avoid: ["shoulders", "wrists"] }),
      11,
    );
    expect(session.blocks.length).toBeGreaterThan(0);
    for (const b of session.blocks) {
      const loads = movementById.get(b.movementId)?.loads ?? [];
      expect(loads).not.toContain("shoulders");
      expect(loads).not.toContain("wrists");
    }
  });

  it("prescribes at the current tier when unconstrained", () => {
    const session = generateSession(
      realLibrary,
      profileAtTier(3),
      emptyHistory,
      prompt({ energy: "okay" }),
      5,
    );
    for (const b of session.blocks) {
      expect(movementById.get(b.movementId)?.tier).toBe(3);
    }
  });
});

describe("generateSession — pattern staleness", () => {
  it("prioritises the stalest pattern", () => {
    // pull absent for 3 training days, everything else fresh.
    const history = historyWithPatterns([
      ["pull"],
      ["push", "squat", "hinge", "core"],
      ["push", "squat", "hinge", "core"],
      ["push", "squat", "hinge", "core"],
    ]);
    const session = generateSession(
      realLibrary,
      createInitialProfile(),
      history,
      prompt({ minutes: 10 }),
      9,
    );
    expect(session.blocks[0]?.pattern).toBe("pull");
  });

  it("covers every pattern in a 20-minute session", () => {
    const session = generateSession(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      prompt({ minutes: 20 }),
      13,
    );
    const covered = new Set(session.blocks.map((b) => b.pattern));
    for (const p of PATTERNS) expect(covered.has(p)).toBe(true);
  });
});

describe("generateSession — energy", () => {
  it("low energy reduces volume at the same tier", () => {
    const low = generateSession(
      realLibrary,
      profileAtTier(2),
      emptyHistory,
      prompt({ energy: "low", minutes: 20 }),
      21,
    );
    for (const b of low.blocks) {
      expect(b.sets).toBeLessThanOrEqual(2);
      expect(movementById.get(b.movementId)?.tier).toBe(2); // never a tier drop
    }
  });

  it("strong energy adds one next-tier taste block late in the session", () => {
    const session = generateSession(
      realLibrary,
      profileAtTier(2),
      emptyHistory,
      prompt({ energy: "strong", minutes: 30 }),
      31,
    );
    const tastes = session.blocks.filter(
      (b) => (movementById.get(b.movementId)?.tier ?? 0) > 2,
    );
    expect(tastes.length).toBe(1);
    const taste = tastes[0];
    expect(taste?.atNewTier).toBe(false);
    expect(taste?.sets).toBe(1);
    expect(movementById.get(taste?.movementId ?? "")?.tier).toBe(3);
    // Late in the session: it is the final block.
    expect(session.blocks[session.blocks.length - 1]).toBe(taste);
  });

  it("no taste block above tier 6", () => {
    const session = generateSession(
      realLibrary,
      profileAtTier(6),
      emptyHistory,
      prompt({ energy: "strong", minutes: 30 }),
      33,
    );
    for (const b of session.blocks) {
      expect(movementById.get(b.movementId)?.tier).toBeLessThanOrEqual(6);
    }
  });
});

describe("generateSession — the minutes she asked for (owner decision 2026-09-07)", () => {
  it("one surviving pattern still fills a 30-minute session to the target", () => {
    // shoulders + hips leaves core alone (see docs/engine-decision-tree.md).
    for (const seed of [1, 2, 3]) {
      for (const energy of ["low", "okay", "strong"] as Energy[]) {
        const p = prompt({ minutes: 30, energy, avoid: ["shoulders", "hips"] });
        const s = generateSession(realLibrary, profileAtTier(2), emptyHistory, p, seed);
        expect(s.blocks.length).toBeGreaterThan(0);
        expect(s.estimatedTotalSeconds).toBeLessThanOrEqual(30 * 60);
        expect(s.estimatedTotalSeconds).toBeGreaterThanOrEqual(30 * 60 * TARGET_UTILIZATION);
        expect(s.blocks.every((b) => b.pattern === "core")).toBe(true);
      }
    }
  });

  it("two surviving patterns fill 20 and 30 minutes to the target", () => {
    for (const minutes of [20, 30] as SessionMinutes[]) {
      const p = prompt({ minutes, avoid: ["back", "hips"] });
      const s = generateSession(realLibrary, profileAtTier(3), emptyHistory, p, 5);
      expect(s.estimatedTotalSeconds).toBeGreaterThanOrEqual(minutes * 60 * TARGET_UTILIZATION);
    }
  });

  it("the cap grows as patterns fall away", () => {
    expect(maxBlocksPerPattern(5)).toBe(2);
    expect(maxBlocksPerPattern(4)).toBe(3);
    expect(maxBlocksPerPattern(3)).toBe(4);
    expect(maxBlocksPerPattern(2)).toBe(6);
    expect(maxBlocksPerPattern(1)).toBe(12);
  });

  it("walks down the ladder for a fresh movement before repeating one", () => {
    // Tier 3, 30 minutes, shoulders avoided: squat, hinge and core remain,
    // each with unused movements at tiers 1 to 3. No movement may repeat
    // while the pattern still has an eligible one she has not done today.
    const p = prompt({ minutes: 30, energy: "okay", avoid: ["shoulders"] });
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = generateSession(realLibrary, profileAtTier(3), emptyHistory, p, seed);
      const seen = new Set<string>();
      for (const b of s.blocks) {
        if (seen.has(b.movementId)) {
          const m = movementById.get(b.movementId);
          const eligibleUnused = realLibrary.movements.filter(
            (x) =>
              x.pattern === m?.pattern &&
              x.tier <= 3 &&
              !x.loads.includes("shoulders") &&
              (x.equipment === "none" || x.equipment === "wall" || p.equipment.includes(x.equipment)) &&
              !seen.has(x.id),
          );
          expect(eligibleUnused, `${b.movementId} repeated with fresh options left`).toEqual([]);
        }
        seen.add(b.movementId);
      }
    }
  });

  it("repeats only at the top of the ladder once every eligible movement is used", () => {
    const p = prompt({ minutes: 30, energy: "okay", avoid: ["shoulders", "hips"] });
    const s = generateSession(realLibrary, profileAtTier(2), emptyHistory, p, 9);
    const first = new Map<string, number>();
    s.blocks.forEach((b, i) => {
      if (!first.has(b.movementId)) first.set(b.movementId, i);
    });
    // Every eligible core movement at tiers 1 and 2 appears before any repeat.
    const eligible = realLibrary.movements.filter(
      (x) => x.pattern === "core" && x.tier <= 2 && !x.loads.some((a) => a === "shoulders" || a === "hips"),
    );
    const firstRepeatIndex = s.blocks.findIndex((b, i) => first.get(b.movementId) !== i);
    if (firstRepeatIndex >= 0) {
      for (const m of eligible) {
        expect(first.get(m.id), `${m.id} unused before a repeat`).toBeLessThan(firstRepeatIndex);
      }
    }
  });
});
