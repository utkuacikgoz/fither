import { StyleSheet, View } from "react-native";
import type { StreakState } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { useTheme } from "../../design/theme";
import { fontFamily, spacing } from "../../design/tokens";

// The streak on the hub (ADR-0018, owner-approved 2026-09-06): one line
// under the headline — a green dot, the count, and one caption after it.
// Untrained today it names what today does (never what a miss costs);
// trained, it names her best run when there is a longer one to name.
// Nothing renders with no run alive: the hub never shows a zero.

interface StreakLineProps {
  streak: StreakState;
  /** Whether today already holds a completed block. */
  trainedToday: boolean;
  testID?: string;
}

export function StreakLine({ streak, trainedToday, testID }: StreakLineProps) {
  const colors = useTheme();
  if (streak.current === 0) return null;

  const caption = trainedToday
    ? streak.best > streak.current
      ? strings.streak.best(streak.best)
      : null
    : strings.streak.atRiskToday;

  return (
    <View
      style={styles.row}
      {...(testID ? { testID } : {})}
      accessibilityRole="text"
      accessibilityLabel={[strings.streak.label(streak.current), caption]
        .filter(Boolean)
        .join(". ")}
    >
      <View style={[styles.dot, { backgroundColor: colors.accent }]} />
      <AppText variant="body" style={styles.count} color={colors.ink}>
        {strings.streak.label(streak.current)}
      </AppText>
      {caption ? <AppText variant="caption">{caption}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  count: {
    fontFamily: fontFamily.semibold,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
