// The body of tomorrow's invitation (ADR-0018: the daily invitation may
// name the streak). Pure and app-side: it only chooses WORDS from two
// facts the engine already decided — the streak state from
// `computeStreak` and "trained today" from `todayTraining` — and never
// re-derives either. Callers pass both; nothing here reads history.
//
// No-guilt rule (fither-domain): both streak bodies describe what today's
// session does, never what a miss would cost, and when no run is alive
// the generic invitation stands — nothing about a streak that ended.

import type { StreakState } from "@fither/engine";

import { strings } from "../copy/strings";

export function invitationBody(
  streak: StreakState,
  trainedToday: boolean,
): string {
  if (streak.current > 0 && trainedToday) {
    // Tomorrow is the day after she trained: what tomorrow's session
    // would make the run. Always 2 or more, as the copy assumes.
    return strings.streak.notification.nextDay(streak.current + 1);
  }
  if (streak.current > 0) {
    // A run is alive but today is untrained (today may become its rest
    // day): tomorrow it is still going, at today's count.
    return strings.streak.notification.keepsGoing(streak.current);
  }
  // No run alive: one of the four interchangeable generic bodies. A fixed
  // pick keeps the helper pure; the adapter rotates the rest of the week.
  return strings.notifications.daily.fitsToday;
}
