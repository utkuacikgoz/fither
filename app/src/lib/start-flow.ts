// The one-time ask on the way INTO a session (owner decision 2026-09-08),
// the mirror of close-flow.ts: the preview's Begin reads its next route
// here, so the ask cannot be wired into one start and forgotten on
// another. Owed once ever, only when a voice is bundled, and it fails
// safe: unhydrated settings mean no ask, never a nag.

import { voiceAskDue } from "../state/settings-store";

export type StartRoute = "/voice-ask" | "/session";

/** Where Begin goes: the voice ask while it is owed, else the player. */
export function nextStartRoute(): StartRoute {
  return voiceAskDue() ? "/voice-ask" : "/session";
}
