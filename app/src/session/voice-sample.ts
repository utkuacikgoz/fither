import type { MovementLibrary } from "@fither/engine";

import { voiceCue } from "./voice-manifest";

/**
 * The line the voice says when she switches it on: a real in-set cue,
 * the first in the library that has a bundled file, so the sample is
 * exactly what a session sounds like and nothing is recorded for the
 * sake of a demo. Null when nothing is bundled (the ask is never shown
 * then either) or the library is absent.
 */
export function sampleCue(library: MovementLibrary | null): string | null {
  if (!library) return null;
  for (const movement of library.movements) {
    for (const cue of movement.inSetCues) {
      if (voiceCue(cue) !== null) return cue;
    }
  }
  return null;
}
