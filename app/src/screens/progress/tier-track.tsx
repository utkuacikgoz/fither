import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { MAX_TIER, type Pattern, type Tier } from "@fither/engine";

import { useTheme } from "../../design/theme";
import { motion, radius, spacing } from "../../design/tokens";

// The ladder, drawn: a six-step track (length from the engine's MAX_TIER,
// never a hardcoded 6) whose reached steps draw in left to right when the
// screen appears — a progress fill, which ADR-0013 §3 makes a moving
// element rather than a static bar.
//
// Decorative by construction: the tier line beside the track carries the
// accessible reading ("Tier 4 of 6"), so the track is hidden from
// accessibility rather than given a second, redundant voice.

interface TrackStepProps {
  filled: boolean;
  delayMs: number;
  reduceMotion: boolean;
  testID?: string;
}

/**
 * One step. The empty rail is always there; a reached step is an accent
 * pill fading in on top of it, so the fill animates on the native driver
 * (a colour cannot) and an unreached step never animates at all.
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
    <View style={[styles.step, { backgroundColor: colors.accentSoft }]}>
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
  const steps = Array.from({ length: MAX_TIER }, (_, i) => i + 1);
  return (
    <View
      style={styles.track}
      testID={`tier-track-${pattern}`}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {steps.map((step) => (
        <TrackStep
          key={step}
          filled={step <= tier}
          reduceMotion={reduceMotion}
          delayMs={baseDelayMs + (step - 1) * motion.fillStaggerMs}
          {...(step <= tier
            ? { testID: `tier-track-${pattern}-filled-${step}` }
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
