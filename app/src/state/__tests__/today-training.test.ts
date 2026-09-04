import type { HistoryEntry } from "@fither/engine";

import { todayTraining } from "../today-training";

// The single definition of "done for today" (ADR-0012 §2), now shared by
// the hub. It reads engine-written outcomes; these cases pin the two
// honest claims it makes.

const TODAY = "2026-09-04";

function entry(
  minutes: 10 | 20 | 30,
  outcomes: Array<"completed" | "struggled" | "skipped">,
  date = TODAY,
): HistoryEntry {
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

it("an empty history has trained nothing", () => {
  expect(todayTraining([], TODAY)).toEqual({
    trained: false,
    everyBlockCompleted: true,
    minutes: 0,
  });
});

it("one completed block makes today trained", () => {
  const result = todayTraining([entry(10, ["completed", "skipped"])], TODAY);
  expect(result.trained).toBe(true);
});

it("an all-skipped session is not training", () => {
  expect(todayTraining([entry(10, ["skipped", "skipped"])], TODAY).trained).toBe(
    false,
  );
});

it("claims minutes only when every block of every trained entry completed", () => {
  const full = todayTraining(
    [entry(10, ["completed"]), entry(20, ["completed", "completed"])],
    TODAY,
  );
  expect(full).toEqual({ trained: true, everyBlockCompleted: true, minutes: 30 });

  const partial = todayTraining(
    [entry(10, ["completed"]), entry(20, ["completed", "struggled"])],
    TODAY,
  );
  expect(partial.everyBlockCompleted).toBe(false);
});

it("an all-skipped entry never dilutes a full session's claim", () => {
  const result = todayTraining(
    [entry(10, ["completed", "completed"]), entry(20, ["skipped", "skipped"])],
    TODAY,
  );
  expect(result).toEqual({ trained: true, everyBlockCompleted: true, minutes: 10 });
});

it("another day's entries are never today's", () => {
  const result = todayTraining(
    [entry(30, ["completed"], "2026-09-03")],
    TODAY,
  );
  expect(result.trained).toBe(false);
  expect(result.minutes).toBe(0);
});
