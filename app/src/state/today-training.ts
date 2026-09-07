import { trainedDay, type HistoryEntry } from "@fither/engine";

// What today's history says about today — the single definition of "done
// for today" (audit wave 2, ADR-0012 §2). It lived inline in the daily
// prompt until the home hub (ADR-0013) needed the same answer; it lives
// here so there is exactly ONE definition, never two that can drift.
//
// This is a READ of engine-written outcomes, not a rule: the engine
// decides what each block's outcome is, and history is its record. The
// two facts read here are:
//
//   - today counts as trained only when an entry recorded at least one
//     COMPLETED block. An all-skipped session enters history too, and it
//     is not training.
//   - the minutes claim is made only when it is TRUE: every block of
//     every trained entry completed, so the entry's planned minutes were
//     actually trained. Any partial entry means we cannot honestly total
//     minutes, and the caller must claim none.

export interface TodayTraining {
  /** At least one attempted block (completed or struggled) landed in history today. */
  trained: boolean;
  /**
   * Every block of every trained entry today completed. Only then may a
   * minutes total be claimed. False whenever anything was partial.
   */
  everyBlockCompleted: boolean;
  /** Total planned minutes of today's trained entries. */
  minutes: number;
}

export function todayTraining(
  entries: readonly HistoryEntry[],
  today: string,
): TodayTraining {
  const trainedToday = entries.filter(
    (entry) =>
      // The engine's one definition of a trained day (ADR-0018 §1 as
      // amended by ADR-0023): attempted, not just completed.
      entry.date === today && trainedDay(entry),
  );
  return {
    trained: trainedToday.length > 0,
    everyBlockCompleted: trainedToday.every((entry) =>
      entry.blocks.every((block) => block.outcome === "completed"),
    ),
    minutes: trainedToday.reduce((sum, entry) => sum + entry.minutes, 0),
  };
}
