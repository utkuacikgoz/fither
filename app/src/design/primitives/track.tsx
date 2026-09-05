import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { motion, radius, spacing } from "../tokens";

// A segmented track: the app's one way of drawing "how far along". The
// tier ladders on Progress and the four-question flow both use it, so a
// step reached looks the same wherever she meets it.
//
// Decorative by construction — a track is never the accessible reading.
// Whatever it draws is said in words beside it (the tier line) or by the
// wrapper that gives it meaning (FlowProgress' progressbar role).

interface TrackStepProps {
  filled: boolean;
  delayMs: number;
  reduceMotion: boolean;
  testID?: string;
}

/**
 * One segment. The empty rail (the `rail` token — chosen so filled and
 * empty read ≥ 3:1 apart) is always there; a reached segment is an
 * accent pill fading in on top of it, so the fill runs on the native
 * driver (a colour cannot) and an unreached segment never animates.
 *
 * The animation is keyed to BECOMING filled, not to rendering: a segment
 * already lit stays lit through its siblings' changes instead of
 * replaying every time the track re-renders.
 */
function TrackStep({ filled, delayMs, reduceMotion, testID }: TrackStepProps) {
  const colors = useTheme();
  const draw = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (!filled) return;
    if (reduceMotion) {
      draw.setValue(1);
      return;
    }
    const animation = Animated.timing(draw, {
      toValue: 1,
      duration: motion.fadeMs,
      delay: delayMs,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [draw, filled, delayMs, reduceMotion]);

  return (
    <View style={[styles.step, { backgroundColor: colors.rail }]}>
      {filled && (
        <Animated.View
          testID={testID}
          style={[
            StyleSheet.absoluteFill,
            styles.stepFill,
            { backgroundColor: colors.accent, opacity: draw },
          ]}
        />
      )}
    </View>
  );
}

interface TrackProps {
  /** Total segments. Always passed from real structure, never a literal. */
  steps: number;
  /** How many are reached, counting from the left. */
  reached: number;
  reduceMotion: boolean;
  /**
   * Per-segment delay, so a fill draws in left to right on mount. 0 (the
   * default) lights reached segments together — right for a track that
   * gains one segment at a time, where a re-stagger would be noise.
   */
  staggerMs?: number;
  /** Delay before the first segment, e.g. while its card is still entering. */
  baseDelayMs?: number;
  testID?: string;
  /** Filled segments carry `${filledTestID}-${step}`, for tests. */
  filledTestID?: string;
}

export function Track({
  steps,
  reached,
  reduceMotion,
  staggerMs = 0,
  baseDelayMs = 0,
  testID,
  filledTestID,
}: TrackProps) {
  return (
    <View
      style={styles.track}
      testID={testID}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {Array.from({ length: steps }, (_, index) => index + 1).map((step) => (
        <TrackStep
          key={step}
          filled={step <= reached}
          reduceMotion={reduceMotion}
          delayMs={baseDelayMs + (step - 1) * staggerMs}
          {...(step <= reached && filledTestID
            ? { testID: `${filledTestID}-${step}` }
            : {})}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  step: {
    flex: 1,
    height: spacing.xs,
    borderRadius: radius.pill,
  },
  stepFill: {
    borderRadius: radius.pill,
  },
});
