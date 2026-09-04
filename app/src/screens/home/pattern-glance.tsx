import { StyleSheet, View } from "react-native";
import { MAX_TIER, PATTERNS, type Profile } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { useTheme } from "../../design/theme";
import { radius, spacing } from "../../design/tokens";

// The five ladders at a glance — the same tier-track idea the progress
// screen renders, shrunk to one row. Every value is read from the
// profile the engine wrote (tier per pattern) and the engine's MAX_TIER;
// nothing about progression is decided here.

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

export function PatternGlance({ profile }: { profile: Profile }) {
  const colors = useTheme();
  const steps = Array.from({ length: MAX_TIER }, (_, i) => i + 1);
  return (
    <View style={styles.row}>
      {PATTERNS.map((pattern) => {
        const { tier } = profile.patterns[pattern];
        return (
          <View
            key={pattern}
            style={styles.column}
            testID={`home-pattern-${pattern}`}
          >
            <View style={styles.track}>
              {steps.map((step) => (
                <View
                  key={step}
                  testID={
                    step <= tier
                      ? `home-pattern-${pattern}-filled-${step}`
                      : undefined
                  }
                  style={[
                    styles.trackStep,
                    {
                      backgroundColor:
                        step <= tier ? colors.accent : colors.accentSoft,
                    },
                  ]}
                />
              ))}
            </View>
            <AppText variant="caption" numberOfLines={1} style={styles.name}>
              {strings.profile.patterns.names[pattern]}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  column: {
    flex: 1,
  },
  track: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  trackStep: {
    flex: 1,
    height: spacing.xs,
    borderRadius: radius.pill,
  },
  name: {
    // The glance names the ladder; the tier itself is spoken in the row's
    // accessibility label and set in full on the progress screen.
    textAlign: "left",
  },
});
