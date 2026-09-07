import {
  unblockingAreas,
  type BodyArea,
  type DailyPrompt,
  type History,
  type Profile,
} from "@fither/engine";

import { loadLibrary } from "./load-library";
import { deriveSeed } from "./seed";

/**
 * Which areas, set aside alone for today, would let the engine build a
 * session — the engine's own answer (unblockingAreas), asked with the
 * same library and the same seed createSession would use, so the row she
 * taps leads to the session the engine already found. App-side plumbing
 * only: no filter is re-derived here.
 */
export function unblockingAreasFor(
  prompt: DailyPrompt,
  profile: Profile,
  history: History,
  salt: number,
): BodyArea[] {
  const library = loadLibrary();
  if (!library) return [];
  try {
    return unblockingAreas(
      library,
      profile,
      history,
      prompt,
      deriveSeed(prompt.date, salt),
    );
  } catch {
    return [];
  }
}
