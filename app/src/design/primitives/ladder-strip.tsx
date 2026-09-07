import { StyleSheet, View } from "react-native";
import { MAX_TIER, type MovementLibrary, type Pattern, type Tier } from "@fither/engine";

import { skillFigureId } from "../../session/skill-name";
import { spacing } from "../tokens";
import { MovementFigure } from "./movement-figure";
import { Track } from "./track";

// The ladder as a picture (ADR-0017, owner-approved 2026-09-06): one
// pattern's six tiers drawn left to right, each figure a little larger
// than the last, the tiers she has reached in the green and the rest in
// soft grey, with the same six-segment track beneath. The paywall, the
// gated day and the lifetime offer all sell with this image because it
// is the honest one we own: what the climb looks like, and where she is
// on it. Purely visual: the track carries the accessible value.

interface LadderStripProps {
  library: MovementLibrary | null;
  pattern: Pattern;
  /** Her current tier on this pattern: these many figures are green. */
  reached: Tier;
  reduceMotion: boolean;
  testID?: string;
}

const FIRST_BOX = 40;
const STEP = 6;

export function LadderStrip({ library, pattern, reached, reduceMotion, testID }: LadderStripProps) {
  const tiers = Array.from({ length: MAX_TIER }, (_, i) => (i + 1) as Tier);
  return (
    <View testID={testID}>
      <View style={styles.figures}>
        {tiers.map((tier) => (
          <View key={tier} style={styles.slot}>
            <MovementFigure
              movementId={skillFigureId(library, pattern, tier)}
              size={FIRST_BOX + (tier - 1) * STEP}
              tone={tier <= reached ? "accent" : "soft"}
              {...(testID ? { testID: `${testID}-tier-${tier}` } : {})}
            />
          </View>
        ))}
      </View>
      <Track
        steps={MAX_TIER}
        reached={reached}
        reduceMotion={reduceMotion}
        {...(testID ? { testID: `${testID}-track`, filledTestID: `${testID}-filled` } : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  figures: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  slot: {
    alignItems: "center",
  },
});
