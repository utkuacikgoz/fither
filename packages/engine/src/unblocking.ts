// When today's avoid list empties the movement pool, the no-session
// outcome recommends which single area to set aside. This is engine
// logic (it re-runs the generator), exported so the UI never re-derives
// the constraint filter. Pure and deterministic: same inputs, same list.

import type { BodyArea, DailyPrompt, History, MovementLibrary, Profile } from "./types";
import { generateSession } from "./generate";

/**
 * Avoided areas which, removed ALONE from `prompt.avoid`, make
 * `generateSession` return at least one block. Ordered as they appear in
 * `prompt.avoid` (first occurrence; duplicates collapse). Empty when the
 * prompt already generates a session, or when no single removal helps.
 */
export function unblockingAreas(
  library: MovementLibrary,
  profile: Profile,
  history: History,
  prompt: DailyPrompt,
  seed: number,
): BodyArea[] {
  const hasBlocks = (p: DailyPrompt): boolean =>
    generateSession(library, profile, history, p, seed).blocks.length > 0;

  if (hasBlocks(prompt)) return [];

  const result: BodyArea[] = [];
  for (const area of prompt.avoid) {
    if (result.includes(area)) continue;
    const without: DailyPrompt = {
      ...prompt,
      avoid: prompt.avoid.filter((a) => a !== area),
    };
    if (hasBlocks(without)) result.push(area);
  }
  return result;
}
