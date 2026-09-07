import type { BlockOutcome, HistoryEntry } from "@fither/engine";

import { sessionReceipt } from "../receipt";

// A read of engine-written outcomes into the receipt's counts and close
// (ADR-0023 accounting). Each close, plus the entry with no blocks.

function entry(outcomes: BlockOutcome[], minutes: 10 | 20 | 30 = 20): HistoryEntry {
  return {
    date: "2026-09-07",
    minutes,
    blocks: outcomes.map((outcome, index) => ({
      movementId: `movement-${index}`,
      pattern: "push",
      outcome,
    })),
  };
}

describe("sessionReceipt", () => {
  it("completed: every block completed", () => {
    const receipt = sessionReceipt(entry(["completed", "completed", "completed"], 30));
    expect(receipt).toEqual({
      date: "2026-09-07",
      minutesPlanned: 30,
      done: 3,
      hard: 0,
      skipped: 0,
      movementIds: ["movement-0", "movement-1", "movement-2"],
      close: "completed",
    });
  });

  it("completed: a struggled block among completed ones is still done, nothing left out", () => {
    const receipt = sessionReceipt(entry(["completed", "struggled", "completed"]));
    expect(receipt.close).toBe("completed");
    expect(receipt.done).toBe(2);
    expect(receipt.hard).toBe(1);
    expect(receipt.skipped).toBe(0);
    expect(receipt.movementIds).toEqual(["movement-0", "movement-1", "movement-2"]);
  });

  it("partial: some attempted, some skipped — attempted ids only, in session order", () => {
    const receipt = sessionReceipt(entry(["completed", "skipped", "struggled", "skipped"]));
    expect(receipt.close).toBe("partial");
    expect(receipt.done).toBe(1);
    expect(receipt.hard).toBe(1);
    expect(receipt.skipped).toBe(2);
    expect(receipt.movementIds).toEqual(["movement-0", "movement-2"]);
  });

  it("hard: attempted with no completed block", () => {
    const receipt = sessionReceipt(entry(["struggled", "struggled"]));
    expect(receipt.close).toBe("hard");
    expect(receipt.done).toBe(0);
    expect(receipt.hard).toBe(2);
    expect(receipt.movementIds).toEqual(["movement-0", "movement-1"]);
  });

  it("hard even when some blocks were skipped: nothing completed wins over partial", () => {
    const receipt = sessionReceipt(entry(["struggled", "skipped"]));
    expect(receipt.close).toBe("hard");
    expect(receipt.skipped).toBe(1);
    expect(receipt.movementIds).toEqual(["movement-0"]);
  });

  it("empty: every block skipped", () => {
    const receipt = sessionReceipt(entry(["skipped", "skipped"], 10));
    expect(receipt.close).toBe("empty");
    expect(receipt.done).toBe(0);
    expect(receipt.hard).toBe(0);
    expect(receipt.skipped).toBe(2);
    expect(receipt.movementIds).toEqual([]);
  });

  it("empty: an entry with no blocks at all", () => {
    const receipt = sessionReceipt(entry([], 10));
    expect(receipt).toEqual({
      date: "2026-09-07",
      minutesPlanned: 10,
      done: 0,
      hard: 0,
      skipped: 0,
      movementIds: [],
      close: "empty",
    });
  });

  it("the minutes are the planned length, whatever was attempted — never a measured claim", () => {
    expect(sessionReceipt(entry(["skipped"], 30)).minutesPlanned).toBe(30);
    expect(sessionReceipt(entry(["completed", "skipped"], 20)).minutesPlanned).toBe(20);
    expect(sessionReceipt(entry(["completed"], 10))).not.toHaveProperty("minutes");
  });
});
