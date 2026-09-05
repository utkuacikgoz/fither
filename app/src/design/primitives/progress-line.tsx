import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { useTheme } from "../theme";
import { motion, radius, spacing } from "../tokens";

interface ProgressLineProps {
  /** 0..1 */
  fraction: number;
  completed?: number;
  total?: number;
  /** Reduce Motion: the fill sits at its value, never mid-sweep. */
  reduceMotion: boolean;
  testID?: string;
}

/**
 * The session's only chrome: a thin line filling along the top. The fill
 * MOVES to each new value (ADR-0013 §3 — a progress fill is a moving
 * thing) as a left-anchored scale on the native driver, one ease-out
 * inside the same envelope as everything else. It is the same 4pt pill
 * as the Track primitive's segments, so the two progress forms agree.
 */
export function ProgressLine({
  fraction,
  completed,
  total,
  reduceMotion,
  testID,
}: ProgressLineProps) {
  const colors = useTheme();
  const clamped = Math.min(1, Math.max(0, fraction));
  const scale = useRef(new Animated.Value(reduceMotion ? clamped : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(clamped);
      return;
    }
    const animation = Animated.timing(scale, {
      toValue: clamped,
      duration: motion.fadeMs,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [clamped, reduceMotion, scale]);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={strings.player.sessionProgress}
      accessibilityValue={
        completed !== undefined && total !== undefined
          ? { min: 0, max: total, now: completed }
          : { min: 0, max: 100, now: Math.round(clamped * 100) }
      }
      style={[styles.track, { backgroundColor: colors.accentSoft }]}
    >
      <Animated.View
        testID={testID ? `${testID}-fill` : undefined}
        style={[
          styles.fill,
          {
            backgroundColor: colors.accent,
            transform: [{ scaleX: scale }],
            transformOrigin: "left",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: spacing.xs,
    borderRadius: radius.pill,
    overflow: "hidden",
    alignSelf: "stretch",
  },
  fill: {
    height: spacing.xs,
    width: "100%",
    borderRadius: radius.pill,
  },
});
