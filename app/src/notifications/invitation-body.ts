// The body of tomorrow's invitation (owner brief 2026-09-07, wave 2: the
// week is the consistency display, and streak pressure is out of the
// reminders). Pure and app-side: it only chooses WORDS from facts the
// engine already decided — the week's participation (`weekParticipation`)
// and the intention verdict (`weeklyIntentionMet`) — and never re-derives
// either. Callers pass the week view; nothing here reads history.
//
// No-guilt rule (fither-domain): every body describes what today's
// session would do, never what a miss would cost. A met target never
// says "enough": a further session counts just as much.

import {
  weeklyIntentionMet,
  type WeekParticipation,
  type WeeklyTarget,
} from "@fither/engine";

import { strings } from "../copy/strings";

export interface InvitationFacts {
  /** The engine's read of the current week. */
  participation: WeekParticipation;
  /** The intention the week is read against. */
  target: WeeklyTarget;
  /**
   * Whether any session at all is in history. With none, the week body
   * would count against an intention she has not yet had a session to
   * hold, so the generic invitation stands instead.
   */
  hasHistory: boolean;
}

export function invitationBody({
  participation,
  target,
  hasHistory,
}: InvitationFacts): string {
  if (!hasHistory) {
    // No history at all: one of the four interchangeable generic bodies.
    // A fixed pick keeps the helper pure; the adapter rotates the rest of
    // the week.
    return strings.notifications.daily.fitsToday;
  }
  if (target === null) {
    return strings.notifications.weekly.noTarget;
  }
  if (weeklyIntentionMet(participation, target) === true) {
    return strings.notifications.weekly.met;
  }
  return strings.notifications.weekly.onTrack(participation.count, target);
}
