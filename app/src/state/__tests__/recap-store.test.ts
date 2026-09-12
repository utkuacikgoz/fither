import { previousWeekRecapDue } from "../recap-store";

const entry = (date: string, outcome: "completed" | "struggled" | "skipped") => ({
  date,
  minutes: 10 as const,
  blocks: [{ movementId: "push", pattern: "push" as const, outcome }],
});

describe("previous week recap", () => {
  it("uses engine participation: trained sessions count and skipped-only sessions do not", () => {
    const due = previousWeekRecapDue(
      [
        entry("2026-09-07", "completed"),
        entry("2026-09-07", "struggled"),
        entry("2026-09-08", "skipped"),
        entry("2026-09-14", "completed"),
      ],
      "2026-09-14",
      null,
    );
    expect(due).toMatchObject({
      start: "2026-09-07",
      end: "2026-09-13",
      sessions: 2,
      count: 1,
    });
  });

  it("returns nothing for an empty or already handled previous week", () => {
    expect(previousWeekRecapDue([], "2026-09-14", null)).toBeNull();
    expect(
      previousWeekRecapDue(
        [entry("2026-09-07", "completed")],
        "2026-09-14",
        "2026-09-07",
      ),
    ).toBeNull();
  });
});
