import { describe, expect, it } from "vitest";

import { computeStreak } from "../src/index.js";
import type { BlockOutcome, HistoryEntry } from "../src/index.js";

// ADR-0018: a day is trained when at least one block completed on it;
// consecutive trained days form a run; one missed day per run is forgiven
// as a rest day; a second miss ends the run; the best run is kept. Pure
// over ISO dates — "today" is an input, never a clock.

function entry(date: string, outcome: BlockOutcome = "completed"): HistoryEntry {
  return {
    date,
    minutes: 10,
    blocks: [{ movementId: "wall-push-up", pattern: "push", outcome }],
  };
}

function trained(...dates: string[]): HistoryEntry[] {
  return dates.map((d) => entry(d));
}

const TODAY = "2026-09-07";

describe("computeStreak — empty and single day", () => {
  it("is all zero with no history", () => {
    expect(computeStreak([], TODAY)).toStrictEqual({
      current: 0,
      best: 0,
      graceUsed: false,
      atRisk: false,
    });
  });

  it("one trained day today is a run of one, not at risk", () => {
    expect(computeStreak(trained(TODAY), TODAY)).toStrictEqual({
      current: 1,
      best: 1,
      graceUsed: false,
      atRisk: false,
    });
  });

  it("counts consecutive trained days ending today", () => {
    const s = computeStreak(trained("2026-09-05", "2026-09-06", TODAY), TODAY);
    expect(s).toStrictEqual({ current: 3, best: 3, graceUsed: false, atRisk: false });
  });
});

describe("computeStreak — today is not over", () => {
  it("today untrained with yesterday trained: alive and at risk", () => {
    const s = computeStreak(trained("2026-09-05", "2026-09-06"), TODAY);
    expect(s).toStrictEqual({ current: 2, best: 2, graceUsed: false, atRisk: true });
  });

  it("yesterday missed, the day before trained: alive, grace spent, at risk", () => {
    const s = computeStreak(trained("2026-09-04", "2026-09-05"), TODAY);
    expect(s).toStrictEqual({ current: 2, best: 2, graceUsed: true, atRisk: true });
  });

  it("two clear days end the run even with the grace unspent", () => {
    const s = computeStreak(trained("2026-09-03", "2026-09-04"), TODAY);
    expect(s).toStrictEqual({ current: 0, best: 2, graceUsed: false, atRisk: false });
  });

  it("a missed yesterday spends the grace, so an earlier rest day falls outside the live run", () => {
    // Walking back from yesterday: 6 missed (forgiven), 5 and 4 trained,
    // 3 missed = second miss, so the live run is 4-5 only. The best run
    // ending on the 5th (2, rest, 4, 5) is still 3.
    const s = computeStreak(trained("2026-09-02", "2026-09-04", "2026-09-05"), TODAY);
    expect(s).toStrictEqual({ current: 2, best: 3, graceUsed: true, atRisk: true });
  });

  it("yesterday and the day before both missed: no run alive", () => {
    const s = computeStreak(trained("2026-09-02", "2026-09-04"), TODAY);
    expect(s).toStrictEqual({ current: 0, best: 2, graceUsed: false, atRisk: false });
  });

  it("a day with only skipped blocks is not a trained day", () => {
    const entries = [entry("2026-09-06"), entry(TODAY, "skipped")];
    const s = computeStreak(entries, TODAY);
    expect(s).toStrictEqual({ current: 1, best: 1, graceUsed: false, atRisk: true });
  });

  it("a struggled block is showing up: the day counts (owner decision 2026-09-07)", () => {
    const entries = [entry("2026-09-06"), entry(TODAY, "struggled")];
    const s = computeStreak(entries, TODAY);
    expect(s).toStrictEqual({ current: 2, best: 2, graceUsed: false, atRisk: false });
  });

  it("a day counts when at least one of several entries has a completed block", () => {
    const entries = [entry(TODAY, "skipped"), entry(TODAY, "completed")];
    expect(computeStreak(entries, TODAY).current).toBe(1);
  });
});

describe("computeStreak — the one forgiven miss", () => {
  it("forgives one missed day inside the run and flags the grace", () => {
    // 3, 4 trained; 5 missed; 6, 7 trained → run of 4 with the rest day taken.
    const s = computeStreak(trained("2026-09-03", "2026-09-04", "2026-09-06", TODAY), TODAY);
    expect(s).toStrictEqual({ current: 4, best: 4, graceUsed: true, atRisk: false });
  });

  it("the rest day does not add to the count", () => {
    const s = computeStreak(trained("2026-09-05", TODAY), TODAY);
    expect(s.current).toBe(2);
    expect(s.graceUsed).toBe(true);
  });

  it("a second miss ends the run", () => {
    // 7, 6 trained; 5 missed (grace); 4 trained; 3 missed → ends. 2, 1 belong to an older run.
    const s = computeStreak(
      trained("2026-09-01", "2026-09-02", "2026-09-04", "2026-09-06", TODAY),
      TODAY,
    );
    expect(s.current).toBe(3);
    expect(s.graceUsed).toBe(true);
  });

  it("two consecutive missed days always end the run", () => {
    const s = computeStreak(trained("2026-09-03", "2026-09-06", TODAY), TODAY);
    expect(s).toStrictEqual({ current: 2, best: 2, graceUsed: false, atRisk: false });
  });

  it("grace is false for an unbroken run", () => {
    const s = computeStreak(trained("2026-09-04", "2026-09-05", "2026-09-06", TODAY), TODAY);
    expect(s.graceUsed).toBe(false);
  });
});

describe("computeStreak — best vs current", () => {
  it("keeps the longest run ever when the current one is shorter", () => {
    const s = computeStreak(
      trained("2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05", TODAY),
      TODAY,
    );
    expect(s.current).toBe(1);
    expect(s.best).toBe(5);
  });

  it("best applies the same one-miss rule, and may span a rest day", () => {
    // 1, 2, (3 missed), 4, 5 → best 4 under the rule; then a long gap.
    const s = computeStreak(
      trained("2026-07-01", "2026-07-02", "2026-07-04", "2026-07-05", TODAY),
      TODAY,
    );
    expect(s.best).toBe(4);
    expect(s.current).toBe(1);
  });

  it("best is at least current when the live run is the longest", () => {
    const s = computeStreak(trained("2026-08-30", "2026-09-05", "2026-09-06", TODAY), TODAY);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });

  it("best can be longer than a pre-spent live run ending on the same days", () => {
    // 1, (2 missed), 3, 4 trained; today 6 → 5 missed pre-spends the grace,
    // so the live run is 3, 4 only; the best run ending at 4 is 1, 3, 4.
    const s = computeStreak(trained("2026-09-01", "2026-09-03", "2026-09-04"), "2026-09-06");
    expect(s).toStrictEqual({ current: 2, best: 3, graceUsed: true, atRisk: true });
  });
});

describe("computeStreak — messy input", () => {
  it("is order-independent: unsorted entries give the same result", () => {
    const sorted = trained("2026-09-03", "2026-09-04", "2026-09-06", TODAY);
    const shuffled = [sorted[2]!, sorted[0]!, sorted[3]!, sorted[1]!];
    expect(computeStreak(shuffled, TODAY)).toStrictEqual(computeStreak(sorted, TODAY));
    expect(computeStreak(shuffled, TODAY).current).toBe(4);
  });

  it("several entries on one date count that day once", () => {
    const s = computeStreak(trained(TODAY, TODAY, TODAY, "2026-09-06", "2026-09-06"), TODAY);
    expect(s.current).toBe(2);
    expect(s.best).toBe(2);
  });

  it("does not mutate its input", () => {
    const entries = trained("2026-09-06", "2026-09-04", TODAY);
    const snapshot = JSON.parse(JSON.stringify(entries));
    computeStreak(entries, TODAY);
    expect(entries).toStrictEqual(snapshot);
  });

  it("far-apart dates are separate runs and do not blow up", () => {
    const s = computeStreak(trained("1999-12-31", "2000-01-01", "2020-02-29", TODAY), TODAY);
    expect(s).toStrictEqual({ current: 1, best: 2, graceUsed: false, atRisk: false });
  });
});

describe("computeStreak — calendar arithmetic without a Date", () => {
  it("crosses a month boundary", () => {
    const s = computeStreak(trained("2026-08-31", "2026-09-01"), "2026-09-01");
    expect(s.current).toBe(2);
  });

  it("crosses a year boundary", () => {
    const s = computeStreak(trained("2025-12-30", "2025-12-31", "2026-01-01"), "2026-01-01");
    expect(s.current).toBe(3);
  });

  it("knows a leap day", () => {
    const leap = computeStreak(trained("2028-02-28", "2028-02-29", "2028-03-01"), "2028-03-01");
    expect(leap.current).toBe(3);
    const common = computeStreak(trained("2027-02-28", "2027-03-01"), "2027-03-01");
    expect(common).toStrictEqual({ current: 2, best: 2, graceUsed: false, atRisk: false });
    // Non-leap century year: 2100-02-29 does not exist; Feb 28 → Mar 1 is 1 day.
    const century = computeStreak(trained("2100-02-28", "2100-03-01"), "2100-03-01");
    expect(century.graceUsed).toBe(false);
    expect(century.current).toBe(2);
  });
});
