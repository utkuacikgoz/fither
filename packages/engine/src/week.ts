// Weekly participation (owner brief 2026-09-07, wave 2): the week is the
// primary consistency display. Pure: a fold over history dates and
// "today", no clock, no Date object at all. The app passes its own local
// ISO date, exactly as it does for computeStreak, so there is no timezone
// math here — a calendar date is a string and a day number, nothing more.
//
// This module also owns the ONE definition of a trained day
// (`trainedDay`) and the day arithmetic that streak.ts shares.

import type { HistoryEntry } from "./types";

// ---------- Calendar arithmetic (pure string and integer maths) ----------

/**
 * Days since 1970-01-01 for an ISO yyyy-mm-dd local calendar date.
 * Proleptic Gregorian civil-to-day arithmetic on the string's digits —
 * no Date, no timezone, so two dates one calendar day apart always
 * differ by exactly 1.
 */
export function dayNumber(iso: string): number {
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

/** The inverse of `dayNumber`: an ISO yyyy-mm-dd date for a day count since 1970-01-01. */
export function isoDate(days: number): string {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthFromMarch = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthFromMarch + 2) / 5) + 1;
  const month = monthFromMarch < 10 ? monthFromMarch + 3 : monthFromMarch - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** 1970-01-01 was a Thursday; Monday is 4 days on. Days since the Monday of `days`' week, 0–6. */
function daysSinceMonday(days: number): number {
  return (((days + 3) % 7) + 7) % 7;
}

// ---------- Trained day ----------

/**
 * The ONE definition of a trained day (ADR-0018 §1, amended by ADR-0023):
 * she attempted at least one block — completed or struggled. A session
 * with every block skipped is not training. computeStreak and the week
 * view both read this; nothing else re-derives it.
 */
export function trainedDay(entry: HistoryEntry): boolean {
  return entry.blocks.some((b) => b.outcome !== "skipped");
}

// ---------- Week ----------

export interface Week {
  /** The Monday, ISO yyyy-mm-dd. */
  start: string;
  /** The Sunday, ISO yyyy-mm-dd. */
  end: string;
  /** All seven dates, Monday first. */
  dates: string[];
}

export interface WeekParticipation {
  start: string;
  end: string;
  /** Distinct local dates in the week with a trained entry, ascending. Two sessions on one date count once. */
  trainedDates: string[];
  /** `trainedDates.length`: the number of trained days in the week. */
  count: number;
  /** Trained entries in the week — sessions, not days. */
  sessions: number;
}

/** A weekly intention: two days, three days, or none set. */
export type WeeklyTarget = 2 | 3 | null;

/** The local Monday-to-Sunday week containing `todayIso`. */
export function weekOf(todayIso: string): Week {
  const today = dayNumber(todayIso);
  const monday = today - daysSinceMonday(today);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) dates.push(isoDate(monday + i));
  return { start: dates[0]!, end: dates[6]!, dates };
}

/**
 * Participation in the week containing `todayIso`. Entries are matched by
 * their own local date: an entry dated Sunday and one dated the next
 * Monday fall in different weeks. Order of `entries` does not matter.
 */
export function weekParticipation(
  entries: readonly HistoryEntry[],
  todayIso: string,
): WeekParticipation {
  const week = weekOf(todayIso);
  const first = dayNumber(week.start);
  const last = dayNumber(week.end);
  const days = new Set<number>();
  let sessions = 0;
  for (const entry of entries) {
    if (!trainedDay(entry)) continue;
    const d = dayNumber(entry.date);
    if (d < first || d > last) continue;
    days.add(d);
    sessions += 1;
  }
  const trainedDates = [...days].sort((a, b) => a - b).map(isoDate);
  return {
    start: week.start,
    end: week.end,
    trainedDates,
    count: trainedDates.length,
    sessions,
  };
}

/** Whether the week met the intention; `null` when no intention is set. */
export function weeklyIntentionMet(
  participation: WeekParticipation,
  target: WeeklyTarget,
): boolean | null {
  if (target === null) return null;
  return participation.count >= target;
}

/**
 * The last `weeks` weeks, oldest first, the week containing `todayIso`
 * last. `weeks` of 0 or less gives an empty list.
 */
export function weeksParticipation(
  entries: readonly HistoryEntry[],
  todayIso: string,
  weeks: number,
): WeekParticipation[] {
  const today = dayNumber(todayIso);
  const n = Math.max(0, Math.floor(weeks));
  const out: WeekParticipation[] = [];
  for (let back = n - 1; back >= 0; back--) {
    out.push(weekParticipation(entries, isoDate(today - 7 * back)));
  }
  return out;
}
