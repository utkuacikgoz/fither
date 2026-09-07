import type { HistoryEntry } from "@fither/engine";

import {
  parseShareDate,
  parseShareSource,
  shareLinkKind,
  shareSubject,
} from "../share-subject";

// A Wednesday; the week is Monday 2026-09-07 to Sunday 2026-09-13.
const TODAY = "2026-09-09";

function entry(
  date: string,
  outcomes: Array<"completed" | "struggled" | "skipped">,
  minutes: 10 | 20 | 30 = 10,
): HistoryEntry {
  const ids = ["wall-push-up", "plank", "air-squat"];
  return {
    date,
    minutes,
    blocks: outcomes.map((outcome, i) => ({
      movementId: ids[i] ?? `movement-${i}`,
      pattern: "push",
      outcome,
    })),
  };
}

describe("parseShareSource", () => {
  it("accepts the three sources and treats anything else as a receipt", () => {
    expect(parseShareSource("finish")).toBe("finish");
    expect(parseShareSource("receipt")).toBe("receipt");
    expect(parseShareSource("recap")).toBe("recap");
    expect(parseShareSource(undefined)).toBe("receipt");
    expect(parseShareSource("paywall")).toBe("receipt");
    expect(parseShareSource(["recap", "finish"])).toBe("recap");
  });
});

describe("parseShareDate", () => {
  it("keeps a yyyy-mm-dd and drops anything else", () => {
    expect(parseShareDate("2026-09-09")).toBe("2026-09-09");
    expect(parseShareDate(["2026-09-09"])).toBe("2026-09-09");
    expect(parseShareDate(undefined)).toBeUndefined();
    expect(parseShareDate("")).toBeUndefined();
    expect(parseShareDate("09/09/2026")).toBeUndefined();
    expect(parseShareDate("2026-09-09T10:00")).toBeUndefined();
    expect(parseShareDate("../s/session")).toBeUndefined();
  });
});

describe("shareSubject", () => {
  it("a finish or receipt share is today's last entry: minutes planned, movements attempted, first figure", () => {
    const entries = [
      entry("2026-09-08", ["completed"]),
      entry(TODAY, ["completed", "struggled", "skipped"], 20),
    ];
    for (const source of ["finish", "receipt"] as const) {
      expect(shareSubject(entries, TODAY, null, source, undefined)).toEqual({
        kind: "session",
        minutes: 20,
        movements: 2,
        figureId: "wall-push-up",
      });
    }
  });

  it("takes the LAST entry of the day when two sessions share a date", () => {
    const entries = [
      entry(TODAY, ["completed"], 10),
      entry(TODAY, ["completed", "completed", "completed"], 30),
    ];
    const subject = shareSubject(entries, TODAY, null, "receipt", undefined);
    expect(subject).toEqual({
      kind: "session",
      minutes: 30,
      movements: 3,
      figureId: "wall-push-up",
    });
  });

  it("an explicit date picks that day's entry", () => {
    const entries = [entry("2026-09-08", ["completed"], 30), entry(TODAY, ["completed"], 10)];
    const subject = shareSubject(entries, TODAY, null, "receipt", "2026-09-08");
    expect(subject.kind).toBe("session");
    expect(subject.kind === "session" && subject.minutes).toBe(30);
  });

  it("a session where only skipped blocks remain draws nothing and counts nothing", () => {
    const entries = [entry(TODAY, ["skipped", "skipped"])];
    expect(shareSubject(entries, TODAY, null, "finish", undefined)).toEqual({
      kind: "session",
      minutes: 10,
      movements: 0,
      figureId: "",
    });
  });

  it("a date with no entry falls back to the week, never an invented session", () => {
    const entries = [entry(TODAY, ["completed", "struggled"])];
    expect(shareSubject(entries, TODAY, null, "receipt", "2026-09-01")).toEqual({
      kind: "week",
      sessions: 1,
      movements: 2,
      figureId: "wall-push-up",
    });
    expect(shareSubject([], TODAY, null, "finish", undefined)).toEqual({
      kind: "week",
      sessions: 0,
      movements: 0,
      figureId: "",
    });
  });

  it("a recap is the week containing today: trained sessions, their movements, the latest figure", () => {
    const entries = [
      // Last week: outside.
      entry("2026-09-06", ["completed", "completed", "completed"]),
      // This week: two trained sessions, one skipped-only day (not training).
      entry("2026-09-07", ["completed", "skipped"]),
      entry("2026-09-08", ["skipped"]),
      entry(TODAY, ["struggled", "completed"]),
    ];
    expect(shareSubject(entries, TODAY, 3, "recap", TODAY)).toEqual({
      kind: "week",
      sessions: 2,
      movements: 3,
      figureId: "wall-push-up",
    });
  });

  it("the link kind follows the subject, not the context", () => {
    expect(shareLinkKind({ kind: "session", minutes: 10, movements: 1, figureId: "" })).toBe(
      "session",
    );
    expect(shareLinkKind({ kind: "week", sessions: 2, movements: 4, figureId: "" })).toBe(
      "week",
    );
  });
});
