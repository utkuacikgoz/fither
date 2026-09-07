import type { HistoryEntry, LedgerEvent, Pattern } from "@fither/engine";

import { loadLibrary } from "../../../session/load-library";
import { tiersReachedInWeek, weekRecap } from "../week-recap";

// The recap is a read of engine-written records: the week's trained days
// through weekParticipation, sums of receipts, and tier rows only from
// ledger events the engine dated. Nothing is inferred from the profile.

const library = loadLibrary();
if (!library) throw new Error("bundled movement library missing in test env");

type Outcome = "completed" | "struggled" | "skipped";

function entry(date: string, minutes: 10 | 20 | 30, outcomes: Outcome[]): HistoryEntry {
  return {
    date,
    minutes,
    blocks: outcomes.map((outcome, index) => ({
      movementId: `movement-${index}`,
      pattern: "push",
      outcome,
    })),
  };
}

// Week of Monday 7 to Sunday 13 September 2026.
const ANCHOR = "2026-09-10";

describe("weekRecap", () => {
  it("sums planned minutes and attempted movements over the week's trained entries only", () => {
    const entries = [
      entry("2026-09-06", 30, ["completed"]), // the Sunday before: out of the week
      entry("2026-09-07", 10, ["completed", "completed", "struggled"]),
      entry("2026-09-09", 20, ["completed", "skipped", "struggled", "completed"]),
      entry("2026-09-11", 10, ["skipped", "skipped"]), // fully skipped: not training
      entry("2026-09-14", 10, ["completed"]), // next Monday: out of the week
    ];
    const recap = weekRecap(entries, [], library, ANCHOR);
    expect(recap.week.start).toBe("2026-09-07");
    expect(recap.week.end).toBe("2026-09-13");
    expect(recap.participation.count).toBe(2);
    expect(recap.participation.trainedDates).toEqual(["2026-09-07", "2026-09-09"]);
    expect(recap.minutesPlanned).toBe(30);
    // Done + hard; skipped is not a movement done.
    expect(recap.movements).toBe(6);
    expect(recap.tiersReached).toEqual([]);
  });

  it("a second session on a trained date counts its receipt once, a fully skipped one not at all", () => {
    const entries = [
      entry("2026-09-08", 10, ["completed"]),
      entry("2026-09-08", 20, ["struggled", "completed"]),
      entry("2026-09-08", 30, ["skipped"]),
    ];
    const recap = weekRecap(entries, [], library, ANCHOR);
    expect(recap.participation.count).toBe(1);
    expect(recap.participation.sessions).toBe(2);
    expect(recap.minutesPlanned).toBe(30);
    expect(recap.movements).toBe(3);
  });

  it("an empty week is zero everywhere and never claims a tier", () => {
    const recap = weekRecap([], [], library, ANCHOR);
    expect(recap.participation.count).toBe(0);
    expect(recap.minutesPlanned).toBe(0);
    expect(recap.movements).toBe(0);
    expect(recap.tiersReached).toEqual([]);
  });
});

describe("tiersReachedInWeek", () => {
  const week = weekRecap([], [], library, ANCHOR).week;

  function skillUnlock(date: string, pattern: Pattern, movementId: string): LedgerEvent {
    return { type: "skillUnlock", points: 50, date, pattern, movementId };
  }
  function newTierBlock(date: string, pattern: Pattern, movementId: string): LedgerEvent {
    return { type: "newTierBlock", points: 5, date, pattern, movementId };
  }

  it("lists a tier from the ledger's dated events, the tier read off the event's movement", () => {
    const events: LedgerEvent[] = [
      { type: "session", points: 20, date: "2026-09-08" },
      newTierBlock("2026-09-08", "push", "incline-push-up"), // push tier 2
      skillUnlock("2026-09-10", "squat", "split-squat"), // squat tier 4
    ];
    expect(tiersReachedInWeek(events, library, week)).toEqual([
      { pattern: "push", tier: 2 },
      { pattern: "squat", tier: 4 },
    ]);
  });

  it("orders rows by pattern, then tier", () => {
    const events: LedgerEvent[] = [
      newTierBlock("2026-09-12", "core", "incline-plank"),
      newTierBlock("2026-09-07", "hinge", "glute-bridge-march"),
      newTierBlock("2026-09-09", "push", "kneeling-push-up"),
    ];
    expect(tiersReachedInWeek(events, library, week).map((r) => r.pattern)).toEqual([
      "push",
      "hinge",
      "core",
    ]);
  });

  it("claims a rise once: the week of its earliest event, never a later week's repeat", () => {
    const events: LedgerEvent[] = [
      // Reached tier 4 on Sunday 6th (the unlock), first worked at it on the 8th.
      skillUnlock("2026-09-06", "push", "full-push-up"),
      newTierBlock("2026-09-08", "push", "full-push-up"),
      newTierBlock("2026-09-11", "push", "full-push-up"),
    ];
    expect(tiersReachedInWeek(events, library, week)).toEqual([]);
    const lastWeek = weekRecap([], [], library, "2026-09-06").week;
    expect(tiersReachedInWeek(events, library, lastWeek)).toEqual([{ pattern: "push", tier: 4 }]);
  });

  it("ignores session events, events without a pattern, unknown movements and a missing library", () => {
    const events: LedgerEvent[] = [
      { type: "session", points: 20, date: "2026-09-08" },
      { type: "newTierBlock", points: 5, date: "2026-09-08" },
      newTierBlock("2026-09-08", "pull", "not-a-movement"),
    ];
    expect(tiersReachedInWeek(events, library, week)).toEqual([]);
    expect(
      tiersReachedInWeek([newTierBlock("2026-09-08", "pull", "prone-w-raise")], null, week),
    ).toEqual([]);
  });
});
