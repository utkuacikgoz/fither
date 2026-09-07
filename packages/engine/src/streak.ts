// The day streak (ADR-0018, owner decision 2026-09-06). Pure: a fold
// over history dates and "today", no clock, no Date object at all. A
// day counts as trained when at least one block completed on it (the
// same fact the "session" ledger event records). A run is consecutive
// calendar days of trained days; ONE missed day per run is forgiven as
// a rest day (it adds nothing to the count, the run continues); a second
// miss ends the run. Today is never a miss until it is over: a run that
// is alive but untrained today is `atRisk`, not broken.

import type { HistoryEntry } from "./types";

export interface StreakState {
  /** Consecutive trained days in the current run, counting today if trained. 0 = no run alive. */
  current: number;
  /** Longest run ever, same rule. */
  best: number;
  /** The current run has already spent its one forgiven miss. */
  graceUsed: boolean;
  /** Today is not trained yet and current > 0: today's session keeps the run alive. */
  atRisk: boolean;
}

// ---------- Date helper (pure string arithmetic) ----------

/**
 * Days since 1970-01-01 for an ISO yyyy-mm-dd local calendar date.
 * Proleptic Gregorian civil-to-day arithmetic on the string's digits —
 * no Date, no timezone, so two dates one calendar day apart always
 * differ by exactly 1.
 */
function dayNumber(iso: string): number {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  // Shift the year to start in March so the leap day is the year's last.
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const monthFromMarch = (month + 9) % 12;
  const dayOfYear = Math.floor((153 * monthFromMarch + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

// ---------- Streak ----------

/** Distinct trained day numbers, ascending. Unsorted and repeated dates are fine. */
function trainedDays(entries: readonly HistoryEntry[]): number[] {
  const days = new Set<number>();
  for (const entry of entries) {
    if (entry.blocks.some((b) => b.outcome === "completed")) {
      days.add(dayNumber(entry.date));
    }
  }
  return [...days].sort((a, b) => a - b);
}

interface Run {
  count: number;
  graceUsed: boolean;
}

/**
 * The run that ends at `days[end]`, walking back through earlier trained
 * days: a 1-day gap continues the run; a 2-day gap (one missed day) is
 * forgiven once; anything else — or a second 2-day gap — ends the run.
 * `graceSpent` pre-spends the forgiveness when the miss sits after the
 * run's last trained day (yesterday missed, today still open).
 */
function runEndingAt(days: readonly number[], end: number, graceSpent: boolean): Run {
  let graceUsed = graceSpent;
  let start = end;
  while (start > 0) {
    const gap = (days[start] ?? 0) - (days[start - 1] ?? 0);
    if (gap === 1) {
      start -= 1;
    } else if (gap === 2 && !graceUsed) {
      graceUsed = true;
      start -= 1;
    } else {
      break;
    }
  }
  return { count: end - start + 1, graceUsed };
}

export function computeStreak(entries: readonly HistoryEntry[], today: string): StreakState {
  const days = trainedDays(entries);
  const t = dayNumber(today);
  const index = new Map<number, number>();
  days.forEach((d, i) => index.set(d, i));

  // The live run ends today if today is trained; else yesterday (today is
  // not over); else — if yesterday was the forgiven miss — the day before,
  // with the grace already spent. Two clear days and no run is alive.
  const trainedToday = index.has(t);
  let live: Run = { count: 0, graceUsed: false };
  const todayIndex = index.get(t);
  const yesterdayIndex = index.get(t - 1);
  const dayBeforeIndex = index.get(t - 2);
  if (todayIndex !== undefined) {
    live = runEndingAt(days, todayIndex, false);
  } else if (yesterdayIndex !== undefined) {
    live = runEndingAt(days, yesterdayIndex, false);
  } else if (dayBeforeIndex !== undefined) {
    live = runEndingAt(days, dayBeforeIndex, true);
  }

  // Best ever: every trained day may end a run; keep the longest.
  let best = live.count;
  for (let i = 0; i < days.length; i++) {
    const run = runEndingAt(days, i, false);
    if (run.count > best) best = run.count;
  }

  return {
    current: live.count,
    best,
    graceUsed: live.count > 0 && live.graceUsed,
    atRisk: live.count > 0 && !trainedToday,
  };
}
