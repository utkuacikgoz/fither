import type { Session } from "@fither/engine";

import { hasBegun, isFinished, type PlayerState } from "../session/player-machine";

// What the in-memory session means for TODAY'S card on the hub — the one
// definition, so Home cannot invent a second reading of the player.
//
// "inFlight": she began it and has not finished — "Keep going" into the
//   player. This is the same boundary the session store's crash snapshot
//   is written on, so Home and the launch resume offer agree.
// "built": generated today, never started — the preview's state. Home
//   sends her to the preview (its adaptation line is the rule every
//   surface obeys), never straight into the player.
// "none": nothing, a finished session, or a session dated another day
//   left in memory overnight — applying that under a stale date would
//   write history under yesterday; the card offers today instead.

export type TodaySessionState = "none" | "built" | "inFlight";

export function todaySessionState(
  session: Session | null,
  player: PlayerState | null,
  today: string,
): TodaySessionState {
  if (session === null || player === null) return "none";
  if (session.date !== today) return "none";
  if (isFinished(player)) return "none";
  return hasBegun(player) ? "inFlight" : "built";
}
