import { describe, expect, it } from "vitest";
import {
  formatReport,
  keyMetrics,
  median,
  percentile,
  runAnalysis,
} from "../sim/analyze.js";
import { realLibrary } from "./helpers.js";

describe("sim/analyze", () => {
  it("median and percentile handle Infinity ('never unlocked') correctly", () => {
    expect(median([2, 4, 6])).toBe(4);
    expect(median([2, 4])).toBe(3);
    expect(median([3, Infinity])).toBe(Infinity);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10)).toBe(2);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
  });

  it("is deterministic: same seed, same report, bit for bit", () => {
    // Small run — the point is reproducibility, not the full 500x26 gates.
    const a = runAnalysis(realLibrary, 12345, 12, 4);
    const b = runAnalysis(realLibrary, 12345, 12, 4);
    expect(formatReport(a)).toBe(formatReport(b));
    expect(keyMetrics(a)).toBe(keyMetrics(b));
    expect(a.sessionsGenerated).toBe(b.sessionsGenerated);
    expect(a.sessionsGenerated).toBeGreaterThan(0);
  });

  it("covers every persona and produces the report sections", () => {
    const a = runAnalysis(realLibrary, 12345, 12, 4);
    for (const recs of a.byPersona.values()) {
      expect(recs.length).toBe(2); // 12 users / 6 personas
    }
    const report = formatReport(a);
    for (const heading of [
      "### 1. Median tier per pattern",
      "### 2. Weeks to first skill unlock",
      "### 3. Median cumulative points",
      "### 4. Struggle economics",
      "### 5. Session composition",
      "### 6. Budget utilization",
    ]) {
      expect(report).toContain(heading);
    }
  });
});
