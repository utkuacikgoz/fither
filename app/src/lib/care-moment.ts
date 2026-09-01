// The "everything hurts" moment (2026-09-01 live-testing pass): when
// today's work-around list covers most or all of the 8 body areas, or the
// engine couldn't build a session around it, the next screen leads with a
// caring acknowledgment instead of a bare plan or a dead end.
//
// This is a display-affect threshold ONLY. Nothing here decides what a
// session contains — whether the engine can build, and what it builds,
// stays entirely engine-side (we only read its result). This module
// decides one thing: whether the UI says "that's a lot to carry" first.

/** "Most or all" of the 8 body areas. */
export const CARE_AREA_THRESHOLD = 6;

/**
 * @param selectedAreaCount how many body areas today's prompt works around
 *   (daily picks merged with the persistent avoid-list — what the engine
 *   actually saw).
 * @param engineBuilt whether the engine produced a session for it.
 */
export function needsCareMoment(
  selectedAreaCount: number,
  engineBuilt: boolean,
): boolean {
  if (selectedAreaCount === 0) return false;
  if (!engineBuilt) return true;
  return selectedAreaCount >= CARE_AREA_THRESHOLD;
}
