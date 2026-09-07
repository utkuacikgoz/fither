import { describe, expect, it } from "vitest";

import {
  computeStreak,
  trainedDay,
  weekOf,
  weekParticipation,
  weeklyIntentionMet,
  weeksParticipation,
} from "../src/index.js";
import type { BlockOutcome, HistoryEntry } from "../src/index.js";

// Wave 2: the local Monday-to-Sunday week is the primary consistency
// display. Pure over ISO dates — "today" is an input, never a clock. A
// trained day is one with an attempted block (ADR-0018 §1, ADR-0023),
// the same rule the streak reads.

function entry(date: string, ...outcomes: BlockOutcome[]): HistoryEntry {
  const list = outcomes.length > 0 ? outcomes : ["completed" as const];
  return {
    date,
    minutes: 10,
    blocks: list.map((outcome) => ({ movementId: "wall-push-up", pattern: "push", outcome })),
  };
}

function trained(...dates: string[]): HistoryEntry[] {
  return dates.map((d) => entry(d));
}

// 2026-08-31 is a Monday; 2026-09-07 is the next Monday.
const WEEK = {
  mon: "2026-08-31",
  tue: "2026-09-01",
  wed: "2026-09-02",
  thu: "2026-09-03",
  fri: "2026-09-04",
  sat: "2026-09-05",
  sun: "2026-09-06",
};
const NEXT_MONDAY = "2026-09-07";
const MWF = trained(WEEK.mon, WEEK.wed, WEEK.fri);

describe("weekOf — Monday to Sunday", () => {
  it("a Monday starts a new week", () => {
    expect(weekOf(NEXT_MONDAY)).toStrictEqual({
      start: "2026-09-07",
      end: "2026-09-13",
      dates: [
        "2026-09-07",
        "2026-09-08",
        "2026-09-09",
        "2026-09-10",
        "2026-09-11",
        "2026-09-12",
        "2026-09-13",
      ],
    });
  });

  it("a Sunday belongs to the week that started the previous Monday", () => {
    const week = weekOf(WEEK.sun);
    expect(week.start).toBe(WEEK.mon);
    expect(week.end).toBe(WEEK.sun);
    expect(week.dates).toStrictEqual(Object.values(WEEK));
  });

  it("every day of a week maps to the same week", () => {
    for (const day of Object.values(WEEK)) {
      expect(weekOf(day)).toStrictEqual(weekOf(WEEK.mon));
    }
  });

  it("crosses a year boundary: 2026-12-28 to 2027-01-03", () => {
    const expected = {
      start: "2026-12-28",
      end: "2027-01-03",
      dates: [
        "2026-12-28",
        "2026-12-29",
        "2026-12-30",
        "2026-12-31",
        "2027-01-01",
        "2027-01-02",
        "2027-01-03",
      ],
    };
    expect(weekOf("2026-12-28")).toStrictEqual(expected);
    expect(weekOf("2026-12-31")).toStrictEqual(expected);
    expect(weekOf("2027-01-01")).toStrictEqual(expected);
    expect(weekOf("2027-01-03")).toStrictEqual(expected);
    expect(weekOf("2027-01-04").start).toBe("2027-01-04");
  });

  it("crosses a leap day and a month boundary", () => {
    // 2028-02-28 is a Monday.
    expect(weekOf("2028-03-01").dates).toStrictEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
      "2028-03-02",
      "2028-03-03",
      "2028-03-04",
      "2028-03-05",
    ]);
  });

  it("knows the epoch was a Thursday", () => {
    expect(weekOf("1970-01-01")).toStrictEqual({
      start: "1969-12-29",
      end: "1970-01-04",
      dates: [
        "1969-12-29",
        "1969-12-30",
        "1969-12-31",
        "1970-01-01",
        "1970-01-02",
        "1970-01-03",
        "1970-01-04",
      ],
    });
  });
});

describe("trainedDay — the one rule", () => {
  it("a completed block is a trained day", () => {
    expect(trainedDay(entry(WEEK.mon, "completed"))).toBe(true);
  });

  it("a struggled block is showing up: the day counts (ADR-0023)", () => {
    expect(trainedDay(entry(WEEK.mon, "struggled"))).toBe(true);
    expect(trainedDay(entry(WEEK.mon, "skipped", "struggled", "skipped"))).toBe(true);
  });

  it("all blocks skipped is not training", () => {
    expect(trainedDay(entry(WEEK.mon, "skipped", "skipped"))).toBe(false);
    expect(trainedDay({ date: WEEK.mon, minutes: 10, blocks: [] })).toBe(false);
  });

  it("agrees with the streak", () => {
    const entries = [entry(WEEK.sat, "skipped"), entry(WEEK.sun, "struggled")];
    expect(computeStreak(entries, WEEK.sun).current).toBe(1);
    expect(weekParticipation(entries, WEEK.sun).trainedDates).toStrictEqual([WEEK.sun]);
  });
});

describe("weekParticipation — a Monday/Wednesday/Friday user", () => {
  it("shows count 3 on Friday", () => {
    expect(weekParticipation(MWF, WEEK.fri)).toStrictEqual({
      start: WEEK.mon,
      end: WEEK.sun,
      trainedDates: [WEEK.mon, WEEK.wed, WEEK.fri],
      count: 3,
      sessions: 3,
    });
  });

  it("still shows count 3 on Sunday", () => {
    expect(weekParticipation(MWF, WEEK.sun).count).toBe(3);
    expect(weekParticipation(MWF, WEEK.sun).start).toBe(WEEK.mon);
  });

  it("on the following Monday the new week is empty and last week still holds three", () => {
    const current = weekParticipation(MWF, NEXT_MONDAY);
    expect(current).toStrictEqual({
      start: "2026-09-07",
      end: "2026-09-13",
      trainedDates: [],
      count: 0,
      sessions: 0,
    });
    const [last, now] = weeksParticipation(MWF, NEXT_MONDAY, 2);
    expect(last?.count).toBe(3);
    expect(last?.trainedDates).toStrictEqual([WEEK.mon, WEEK.wed, WEEK.fri]);
    expect(now).toStrictEqual(current);
  });

  it("the streak, by contrast, does not survive the weekend (ADR-0018 consequence)", () => {
    expect(computeStreak(MWF, NEXT_MONDAY).current).toBe(0);
    expect(weekParticipation(MWF, WEEK.sun).count).toBe(3);
  });
});

describe("weekParticipation — counting rules", () => {
  it("is empty with no history", () => {
    expect(weekParticipation([], WEEK.wed)).toStrictEqual({
      start: WEEK.mon,
      end: WEEK.sun,
      trainedDates: [],
      count: 0,
      sessions: 0,
    });
  });

  it("two sessions on one date count once, but both are sessions", () => {
    const p = weekParticipation(trained(WEEK.tue, WEEK.tue, WEEK.thu), WEEK.thu);
    expect(p.trainedDates).toStrictEqual([WEEK.tue, WEEK.thu]);
    expect(p.count).toBe(2);
    expect(p.sessions).toBe(3);
  });

  it("all-skipped entries do not count as a day or a session", () => {
    const entries = [entry(WEEK.mon, "skipped", "skipped"), entry(WEEK.wed)];
    const p = weekParticipation(entries, WEEK.wed);
    expect(p.trainedDates).toStrictEqual([WEEK.wed]);
    expect(p.count).toBe(1);
    expect(p.sessions).toBe(1);
  });

  it("a struggled session counts (ADR-0023)", () => {
    const entries = [entry(WEEK.mon, "struggled", "struggled"), entry(WEEK.wed, "skipped", "struggled")];
    const p = weekParticipation(entries, WEEK.fri);
    expect(p.trainedDates).toStrictEqual([WEEK.mon, WEEK.wed]);
    expect(p.count).toBe(2);
    expect(p.sessions).toBe(2);
  });

  it("a skipped and a completed session on one date: the day counts once, one session", () => {
    const entries = [entry(WEEK.mon, "skipped"), entry(WEEK.mon, "completed")];
    const p = weekParticipation(entries, WEEK.mon);
    expect(p.count).toBe(1);
    expect(p.sessions).toBe(1);
  });

  it("midnight: an entry dated Sunday and one dated Monday fall in different weeks", () => {
    const entries = trained(WEEK.sun, NEXT_MONDAY);
    expect(weekParticipation(entries, WEEK.sun).trainedDates).toStrictEqual([WEEK.sun]);
    expect(weekParticipation(entries, NEXT_MONDAY).trainedDates).toStrictEqual([NEXT_MONDAY]);
  });

  it("ignores entries outside the week on both sides", () => {
    const entries = trained("2026-08-30", WEEK.mon, WEEK.sun, NEXT_MONDAY, "2026-09-20");
    const p = weekParticipation(entries, WEEK.thu);
    expect(p.trainedDates).toStrictEqual([WEEK.mon, WEEK.sun]);
    expect(p.sessions).toBe(2);
  });

  it("is order-independent: unsorted entries give the same, ascending result", () => {
    const sorted = trained(WEEK.mon, WEEK.wed, WEEK.fri, WEEK.sat);
    const shuffled = [sorted[3]!, sorted[0]!, sorted[2]!, sorted[1]!];
    expect(weekParticipation(shuffled, WEEK.sun)).toStrictEqual(weekParticipation(sorted, WEEK.sun));
    expect(weekParticipation(shuffled, WEEK.sun).trainedDates).toStrictEqual([
      WEEK.mon,
      WEEK.wed,
      WEEK.fri,
      WEEK.sat,
    ]);
  });

  it("does not mutate its input", () => {
    const entries = trained(WEEK.fri, WEEK.mon, WEEK.wed);
    const snapshot = JSON.parse(JSON.stringify(entries));
    weekParticipation(entries, WEEK.sun);
    weeksParticipation(entries, WEEK.sun, 3);
    expect(entries).toStrictEqual(snapshot);
  });
});

describe("weeklyIntentionMet", () => {
  const two = weekParticipation(trained(WEEK.mon, WEEK.thu), WEEK.thu);
  const three = weekParticipation(MWF, WEEK.fri);
  const none = weekParticipation([], WEEK.fri);

  it("is null when no intention is set", () => {
    expect(weeklyIntentionMet(three, null)).toBeNull();
    expect(weeklyIntentionMet(none, null)).toBeNull();
  });

  it("compares distinct trained days against the target", () => {
    expect(weeklyIntentionMet(two, 2)).toBe(true);
    expect(weeklyIntentionMet(two, 3)).toBe(false);
    expect(weeklyIntentionMet(three, 2)).toBe(true);
    expect(weeklyIntentionMet(three, 3)).toBe(true);
    expect(weeklyIntentionMet(none, 2)).toBe(false);
  });

  it("two sessions on one day do not meet a two-day intention", () => {
    const p = weekParticipation(trained(WEEK.tue, WEEK.tue), WEEK.tue);
    expect(weeklyIntentionMet(p, 2)).toBe(false);
  });
});

describe("weeksParticipation — the last N weeks", () => {
  it("returns oldest first with the current week last", () => {
    const entries = trained("2026-08-19", "2026-08-24", "2026-08-26", WEEK.mon, WEEK.wed);
    const weeks = weeksParticipation(entries, WEEK.wed, 3);
    expect(weeks.map((w) => [w.start, w.end, w.count])).toStrictEqual([
      ["2026-08-17", "2026-08-23", 1],
      ["2026-08-24", "2026-08-30", 2],
      ["2026-08-31", "2026-09-06", 2],
    ]);
    expect(weeks[2]).toStrictEqual(weekParticipation(entries, WEEK.wed));
  });

  it("every week is a contiguous Monday-to-Sunday block", () => {
    const weeks = weeksParticipation([], "2027-01-01", 4);
    expect(weeks.map((w) => w.start)).toStrictEqual([
      "2026-12-07",
      "2026-12-14",
      "2026-12-21",
      "2026-12-28",
    ]);
    expect(weeks.map((w) => w.end)).toStrictEqual([
      "2026-12-13",
      "2026-12-20",
      "2026-12-27",
      "2027-01-03",
    ]);
  });

  it("one week is the current week; zero weeks is empty", () => {
    expect(weeksParticipation(MWF, WEEK.sun, 1)).toStrictEqual([weekParticipation(MWF, WEEK.sun)]);
    expect(weeksParticipation(MWF, WEEK.sun, 0)).toStrictEqual([]);
    expect(weeksParticipation(MWF, WEEK.sun, -2)).toStrictEqual([]);
  });

  it("an empty week in the middle of a run is reported as empty, not dropped", () => {
    const entries = trained("2026-08-19", WEEK.tue);
    const weeks = weeksParticipation(entries, WEEK.tue, 3);
    expect(weeks.map((w) => w.count)).toStrictEqual([1, 0, 1]);
  });
});
