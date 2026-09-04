import type { Pattern, Tier } from "@fither/engine";
import { MAX_TIER } from "@fither/engine";

import { Track } from "../../design/primitives/track";
import { motion } from "../../design/tokens";

// The ladder, drawn: a six-step track (length from the engine's MAX_TIER,
// never a hardcoded 6) whose reached steps draw in left to right when the
// screen appears — a progress fill, which ADR-0013 §3 makes a moving
// element rather than a static bar.
//
// Decorative by construction: the tier line beside the track carries the
// accessible reading ("Tier 4 of 6").

interface TierTrackProps {
  pattern: Pattern;
  tier: Tier;
  reduceMotion: boolean;
  /** When the card holding this track has finished entering. */
  baseDelayMs?: number;
}

export function TierTrack({
  pattern,
  tier,
  reduceMotion,
  baseDelayMs = 0,
}: TierTrackProps) {
  return (
    <Track
      steps={MAX_TIER}
      reached={tier}
      reduceMotion={reduceMotion}
      staggerMs={motion.fillStaggerMs}
      baseDelayMs={baseDelayMs}
      testID={`tier-track-${pattern}`}
      filledTestID={`tier-track-${pattern}-filled`}
    />
  );
}
