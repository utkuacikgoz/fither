// The day streak (ADR-0018, owner decision 2026-09-06). Pure: a fold
// over history dates and "today", no clock. A day counts when at least
// one block completed on it (the same fact the "session" ledger event
// records). One missed day per run is forgiven as a rest day; a second
// miss ends the run. Today is never a miss until it is over: a run that
// is alive but untrained today is `atRisk`, not broken.

import type { History } from "./types";

export interface Streak {
  /** Trained days in the current run (0 = no run alive). */
  current: number;
  /** The longest run ever, under the same rule. */
  best: number;
  /** The current run has already spent its one rest day. */
  restDayUsed: boolean;
  /** A run is alive and today has not been trained yet. */
  atRisk: boolean;
  /** Today has at least one completed block. */
  trainedToday: boolean;
}

const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
  // ISO calendar dates only (YYYY-MM-DD); UTC math keeps it timezone-free.
  return Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS);
}

function trainedDays(history: History): Set<number> {
  const days = new Set<number>();
  for (const entry of history.entries) {
    if (entry.blocks.some((b) => b.outcome === "completed")) {
      days.add(dayNumber(entry.date));
    }
  }
  return days;
}

/**
 * Walk back from `from` (inclusive) counting trained days, forgiving one
 * miss; stop at the second miss. Returns the count and whether the one
 * rest day sits INSIDE the run (a trailing miss that ended nothing is
 * not a rest day taken).
 */
function runEndingAt(days: Set<number>, from: number): { count: number; restDayUsed: boolean } {
  let count = 0;
  let misses = 0;
  let restDayUsed = false;
  let cursor = from;
  let pendingMiss = false;
  // Bounded: no run outlives the history's span.
  for (let step = 0; step < 100_000; step += 1, cursor -= 1) {
    if (days.has(cursor)) {
      count += 1;
      if (pendingMiss) {
        restDayUsed = true;
        pendingMiss = false;
      }
      continue;
    }
    misses += 1;
    if (misses > 1) break;
    pendingMiss = true;
    if (count === 0) {
      // A miss before any trained day (today untrained, walking back).
      // It is not the run's rest day unless a trained day follows and
      // then another miss is forgiven — handled by the pendingMiss flag.
      pendingMiss = false;
      misses = 0;
      // But only one such leading gap may be crossed: yesterday.
      if (cursor < from) break;
    }
  }
  return { count, restDayUsed };
}

export function computeStreak(history: History, today: string): Streak {
  const days = trainedDays(history);
  const t = dayNumber(today);
  const trainedToday = days.has(t);

  // The live run: from today if trained, else from yesterday (today is
  // still open), else — if yesterday was the rest day — from the day
  // before, with the rest day already spent.
  let current = 0;
  let restDayUsed = false;
  if (trainedToday) {
    ({ count: current, restDayUsed } = runEndingAt(days, t));
  } else if (days.has(t - 1)) {
    ({ count: current, restDayUsed } = runEndingAt(days, t - 1));
  } else if (days.has(t - 2)) {
    const run = runEndingAt(days, t - 2);
    if (!run.restDayUsed) {
      current = run.count;
      restDayUsed = true;
    }
  }

  // Best ever: every trained day can end a run; take the longest.
  let best = current;
  for (const day of days) {
    const run = runEndingAt(days, day);
    if (run.count > best) best = run.count;
  }

  return {
    current,
    best,
    restDayUsed: current > 0 && restDayUsed,
    atRisk: current > 0 && !trainedToday,
    trainedToday,
  };
}
