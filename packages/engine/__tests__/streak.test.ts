import { describe, expect, it } from "vitest";

import { computeStreak } from "../src/streak";
import type { History } from "../src/types";

// ADR-0018: consecutive trained days, one rest day per run forgiven,
// best run kept. Pure over ISO dates; "today" is an input.

function history(dates: string[], skipped: string[] = []): History {
  return {
    entries: [
      ...dates.map((date) => ({
        date,
        minutes: 10 as const,
        blocks: [{ movementId: "wall-push-up", pattern: "push" as const, outcome: "completed" as const }],
      })),
      ...skipped.map((date) => ({
        date,
        minutes: 10 as const,
        blocks: [{ movementId: "wall-push-up", pattern: "push" as const, outcome: "skipped" as const }],
      })),
    ],
  };
}

describe("computeStreak", () => {
  it("is zero with no history", () => {
    expect(computeStreak(history([]), "2026-09-06")).toEqual({
      current: 0, best: 0, restDayUsed: false, atRisk: false, trainedToday: false,
    });
  });

  it("counts consecutive trained days ending today", () => {
    const s = computeStreak(history(["2026-09-04", "2026-09-05", "2026-09-06"]), "2026-09-06");
    expect(s.current).toBe(3);
    expect(s.trainedToday).toBe(true);
    expect(s.atRisk).toBe(false);
    expect(s.restDayUsed).toBe(false);
  });

  it("a run is alive but at risk when today is untrained", () => {
    const s = computeStreak(history(["2026-09-04", "2026-09-05"]), "2026-09-06");
    expect(s).toMatchObject({ current: 2, atRisk: true, trainedToday: false, restDayUsed: false });
  });

  it("forgives one missed day inside a run and reports the rest day taken", () => {
    const s = computeStreak(history(["2026-09-02", "2026-09-03", "2026-09-05", "2026-09-06"]), "2026-09-06");
    expect(s).toMatchObject({ current: 4, restDayUsed: true, atRisk: false });
  });

  it("a second miss ends the run", () => {
    const s = computeStreak(history(["2026-09-01", "2026-09-03", "2026-09-05", "2026-09-06"]), "2026-09-06");
    // 5,6 trained; 4 missed (rest); 3 trained; 2 missed → second miss ends it.
    expect(s.current).toBe(3);
    expect(s.restDayUsed).toBe(true);
  });

  it("yesterday as the rest day keeps the run alive, already spent, at risk", () => {
    const s = computeStreak(history(["2026-09-03", "2026-09-04"]), "2026-09-06");
    expect(s).toMatchObject({ current: 2, restDayUsed: true, atRisk: true });
  });

  it("two clear days end the run even with a rest day unspent", () => {
    const s = computeStreak(history(["2026-09-02", "2026-09-03"]), "2026-09-06");
    expect(s.current).toBe(0);
    expect(s.atRisk).toBe(false);
  });

  it("a run whose rest day is already spent does not survive a missed yesterday", () => {
    // 1 trained, 2 missed (rest), 3 trained, 4 trained; today is 6 → 5 missed.
    const s = computeStreak(history(["2026-09-01", "2026-09-03", "2026-09-04"]), "2026-09-06");
    expect(s.current).toBe(0);
  });

  it("all-skipped days do not count as trained", () => {
    const s = computeStreak(history(["2026-09-05"], ["2026-09-06"]), "2026-09-06");
    expect(s.trainedToday).toBe(false);
    expect(s.current).toBe(1);
    expect(s.atRisk).toBe(true);
  });

  it("keeps the best run ever, longer than the current one", () => {
    const s = computeStreak(
      history(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05", "2026-09-06"]),
      "2026-09-06",
    );
    expect(s.current).toBe(1);
    expect(s.best).toBe(5);
  });

  it("two entries on one day count that day once", () => {
    const s = computeStreak(history(["2026-09-06", "2026-09-06"]), "2026-09-06");
    expect(s.current).toBe(1);
  });
});
