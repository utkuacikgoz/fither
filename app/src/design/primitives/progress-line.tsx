import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { useTheme } from "../theme";

interface ProgressLineProps {
  /** 0..1 */
  fraction: number;
  completed?: number;
  total?: number;
  testID?: string;
}

/** The session's only chrome: a thin line filling along the top. */
export function ProgressLine({ fraction, completed, total, testID }: ProgressLineProps) {
  const colors = useTheme();
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={strings.player.sessionProgress}
      accessibilityValue={
        completed !== undefined && total !== undefined
          ? { min: 0, max: total, now: completed }
          : { min: 0, max: 100, now: Math.round(clamped * 100) }
      }
      style={[styles.track, { backgroundColor: colors.accentSoft }]}
    >
      <View
        style={[
          styles.fill,
          { backgroundColor: colors.accent, width: `${clamped * 100}%` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    alignSelf: "stretch",
  },
  fill: {
    height: 3,
  },
});
