// The one-time asks on the way out of a close (launch checklist, wave 2).
// Three routes leave a session — /finish, /unlock and /intention — and
// each used to know the next interstitial by itself; this is the single
// order they all read, so a new ask cannot be wired into one exit and
// forgotten on another:
//
//   finish → (unlock, if a skill landed) → intention → first-close offer
//          → home. The reminder ask waits for a later completed session.
//
// Both asks are owed only over a close with an attempted block behind it
// (a nothing-done close shows no value, so it asks for nothing), and each
// runs once ever, by its own store's persisted `asked` flag. Both stores
// fail SAFE while unhydrated: a skipped ask costs nothing, a repeated one
// is a nag. App-layer navigation policy only; nothing engine-shaped.

import { intentionAskDue } from "../state/intention-store";
import { reminderAskDue } from "../state/reminder-store";
import type { FinishSummary } from "../state/session-store";
import { firstCloseOfferDue } from "../monetization/first-close-offer";

export type CloseAsk = "/intention" | "/trial-offer" | "/reminder-ask";

/**
 * The next ask still owed after this close, or null when she goes
 * straight home. The intention ask comes first; once it has run
 * (answered or declined) the same call yields the earned commercial
 * offer when due, otherwise the reminder ask.
 */
export function nextCloseAsk(finish: FinishSummary | null): CloseAsk | null {
  if (!finish?.completedAnything) return null;
  if (intentionAskDue()) return "/intention";
  if (firstCloseOfferDue(finish)) return "/trial-offer";
  if (reminderAskDue()) return "/reminder-ask";
  return null;
}
