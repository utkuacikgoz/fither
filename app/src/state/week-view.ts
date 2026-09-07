// The week as the app shows it (owner brief 2026-09-07, wave 2). A pure
// selector over three inputs — history entries, the app's local "today"
// and the intention — and a hook that reads them from the stores. It
// re-derives NOTHING: what counts as a trained day, which dates fall in
// the week and whether the intention is met are all the engine's
// (`weekParticipation`, `weeklyIntentionMet`, week.ts). The only thing
// added here is presentation arithmetic on those answers: how many days
// remain against the target, and which date in the week is the next one
// she has not trained yet.

import {
  weekOf,
  weekParticipation,
  weeklyIntentionMet,
  type HistoryEntry,
  type WeekParticipation,
  type WeeklyTarget,
} from "@fither/engine";
import { useMemo } from "react";

import { useTodayIso } from "../lib/use-today";
import { useIntentionStore } from "./intention-store";
import { useProfileStore } from "./profile-store";

export interface WeekView {
  /** The engine's read of the week containing today. */
  participation: WeekParticipation;
  /** The intention the week is read against. */
  target: WeeklyTarget;
  /** The engine's verdict; null when no intention is set. */
  met: boolean | null;
  /** Days still to train to reach the target (never below 0); null with no target. */
  remaining: number | null;
  /**
   * The next date in this week, today included, with no trained entry —
   * or null when every remaining day of the week is already trained.
   */
  nextTrainingDay: string | null;
}

export function weekView(
  entries: readonly HistoryEntry[],
  todayIso: string,
  target: WeeklyTarget,
): WeekView {
  const participation = weekParticipation(entries, todayIso);
  const met = weeklyIntentionMet(participation, target);
  const remaining =
    target === null ? null : Math.max(0, target - participation.count);
  const trained = new Set(participation.trainedDates);
  // ISO yyyy-mm-dd dates order lexically, so "from today" is a string
  // comparison over the engine's own list of the week's dates.
  const nextTrainingDay =
    weekOf(todayIso).dates.find(
      (date) => date >= todayIso && !trained.has(date),
    ) ?? null;
  return { participation, target, met, remaining, nextTrainingDay };
}

/** The week view from the stores: profile history, today, the intention. */
export function useWeekView(): WeekView {
  const entries = useProfileStore((state) => state.history.entries);
  const target = useIntentionStore((state) => state.target);
  const today = useTodayIso();
  return useMemo(() => weekView(entries, today, target), [entries, today, target]);
}
