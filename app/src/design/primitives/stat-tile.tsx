import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { spacing, tracking, typeScale } from "../tokens";
import { AppText } from "./app-text";
import { Tile } from "./tile";

// A hero number on a tile (Progress, round 6): one numeral set large,
// one or more soft lines beneath it. The numeral takes the numeral
// variant's face — semibold, tabular, Dynamic Type capped — at the
// display size, because two of these sit side by side and the 64pt
// numeral belongs to a number that owns its screen (the finish total,
// the rest count). Both sizes are tokens; nothing here is a new scale.
//
// One accessible element: VoiceOver reads the caller's sentence ("85
// points earned"), never "85" then "points".

export type StatTone = "accent" | "ink";

interface StatTileProps {
  /** The number, already formatted as text. */
  value: string;
  /** Soft lines beneath the numeral, each its own caption. */
  lines: readonly string[];
  /** The green marks the one stat a screen leads with; ink for the rest. */
  tone?: StatTone;
  order?: number;
  reduceMotion: boolean;
  /** The whole tile as one spoken sentence. */
  accessibilityLabel: string;
  testID?: string;
}

export function StatTile({
  value,
  lines,
  tone = "ink",
  order = 0,
  reduceMotion,
  accessibilityLabel,
  testID,
}: StatTileProps) {
  const colors = useTheme();
  return (
    <Tile
      order={order}
      reduceMotion={reduceMotion}
      style={styles.tile}
      accessible
      accessibilityLabel={accessibilityLabel}
      {...(testID ? { testID } : {})}
    >
      <AppText
        variant="numeral"
        color={tone === "accent" ? colors.accent : colors.ink}
        style={styles.value}
        {...(testID ? { testID: `${testID}-value` } : {})}
      >
        {value}
      </AppText>
      <View style={styles.lines}>
        {lines.map((line) => (
          <AppText key={line} variant="caption">
            {line}
          </AppText>
        ))}
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
  },
  value: {
    fontSize: typeScale.display,
    lineHeight: typeScale.display,
    letterSpacing: tracking.display,
  },
  lines: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
});
