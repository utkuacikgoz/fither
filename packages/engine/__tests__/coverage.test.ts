import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { MovementLibrary } from "../src/types";
import { allAvoidSets, runCoverage } from "../sim/coverage";

// The contract the app relies on, pinned over a sampled slice of the
// whole prompt space (the full 331,776-prompt run is `pnpm coverage`).
// Every avoid set is covered; energy, quiet, profiles and seeds are
// thinned so the test stays fast.

const library: MovementLibrary = JSON.parse(
  readFileSync(join(__dirname, "../../../data/movements.json"), "utf8"),
);

const HARD = [
  "noThrow",
  "withinBudget",
  "timingRecomputes",
  "honoursConstraints",
  "prescribesAtOrBelowTier",
  "neverEmptyWithoutAvoid",
  "emptyIffPoolEmpty",
  "unblockingNonEmptyWhenEmpty",
  "filledToTargetWithAtMostOneAvoid",
] as const;

describe("coverage of the daily-prompt space", () => {
  const result = runCoverage(library, {
    energies: ["low", "strong"],
    quiets: [false],
    profiles: ["fresh", "mixed"],
    histories: ["empty"],
    seeds: [7],
    avoidSets: allAvoidSets(),
  });

  it.each(HARD)("%s holds over every avoid set", (invariant) => {
    expect(result.failureCounts.get(invariant) ?? 0).toBe(0);
  });

  it("a session is never over budget and never empty with fewer than three avoided areas", () => {
    for (const [key, bucket] of result.buckets) {
      expect(bucket.overBudget, key).toBe(0);
      const size = Number(key.split(":")[1]);
      if (size <= 2) expect(bucket.empty, key).toBe(0);
    }
    expect(result.firstEmptySize).toBe(3);
  });

  it("one avoided area always fills 30 minutes to the 90% target", () => {
    for (const [area, stats] of result.oneArea30) {
      expect(stats.empty, area).toBe(0);
      expect(stats.minUtilization, area).toBeGreaterThanOrEqual(0.9);
    }
  });
});
