import { StyleSheet, View } from "react-native";
import { MAX_TIER, PATTERNS, type Profile } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { Track } from "../../design/primitives/track";
import { motion, spacing } from "../../design/tokens";

// The five ladders at a glance — the same Track the progress screen
// draws (one 4pt pill everywhere, and it fills as a movement here too;
// the glance used to hand-draw a static copy — reviewer should-fix).
// Five rows, name beside track: the columns it used to draw ellipsised
// "Hip hinge" at default type on a small phone. Every value is read from
// the profile the engine wrote (tier per pattern) and the engine's
// MAX_TIER; nothing about progression is decided here.

/**
 * One screen-reader label for the whole row, assembled from strings.ts
 * values only (pattern name + the tier line, joined). Nothing new is
 * written here — the punctuation is the join, not copy.
 */
export function patternGlanceLabel(profile: Profile): string {
  const ladders = PATTERNS.map(
    (pattern) =>
      `${strings.profile.patterns.names[pattern]}, ${strings.profile.tier(
        profile.patterns[pattern].tier,
        MAX_TIER,
      )}`,
  );
  return [strings.profile.patterns.title, ...ladders].join(". ");
}

interface PatternGlanceProps {
  profile: Profile;
  reduceMotion: boolean;
  /** When the card holding the glance has finished entering. */
  baseDelayMs?: number;
}

export function PatternGlance({ profile, reduceMotion, baseDelayMs = 0 }: PatternGlanceProps) {
  return (
    <View style={styles.rows}>
      {PATTERNS.map((pattern) => {
        const { tier } = profile.patterns[pattern];
        return (
          <View key={pattern} style={styles.row} testID={`home-pattern-${pattern}`}>
            <AppText variant="caption" style={styles.name}>
              {strings.profile.patterns.names[pattern]}
            </AppText>
            <View style={styles.track}>
              <Track
                steps={MAX_TIER}
                reached={tier}
                reduceMotion={reduceMotion}
                staggerMs={motion.fillStaggerMs}
                baseDelayMs={baseDelayMs}
                filledTestID={`home-pattern-${pattern}-filled`}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  name: {
    // Wide enough for the longest ladder name ("Hip hinge") at 2× type
    // without wrapping; the track takes the rest.
    width: spacing.xxxl + spacing.xl,
  },
  track: {
    flex: 1,
  },
});
