import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";

import { useReducedMotion } from "../../lib/use-reduced-motion";
import {
  movementFigure,
  movementFigureFrames,
} from "../../session/movement-figures";
import { useTheme } from "../theme";
import { radius, spacing } from "../tokens";

// Every movement has a face (ADR-0013): no exercise is shown by name
// alone. The art is a white silhouette, tinted here to the theme's own
// accent, so one asset set is correct in light and dark. Placeholder
// craft with real intent — Brief 6's commissioned animation replaces the
// rendering, not the pose.
//
// Decorative by construction: the movement's NAME and prescription carry
// every fact a screen reader needs, so the image is hidden from
// accessibility rather than given a second, redundant label.
//
// Motion (ADR-0019, owner decision 2026-09-07 "option 1 now"): where the
// figure is the hero it breathes between its two keyframes, a slow
// crossfade on a loop, drawn with the Animated API alone. Reduce Motion
// or a missing second frame shows frame A, still.

/** Half a breath: one crossfade from frame A to B, or back. */
export const FIGURE_LOOP_HALF_MS = 1400;

type FigureSize = "small" | "row" | "large" | "hero";

const DIMENSIONS: Record<FigureSize, number> = {
  small: 44,
  row: 56,
  large: 120,
  hero: 200,
};

/**
 * The figure's colour (ADR-0017): white ink is the default everywhere a
 * movement is simply shown (lists, the player); the green is for the
 * one figure a screen celebrates or points at (next skill, unlock, the
 * reached tiers of a ladder); soft grey for what is not yet reached.
 */
export type FigureTone = "ink" | "accent" | "soft";

interface MovementFigureProps {
  movementId: string;
  /** A named size, or an exact box in points (the ladder strip's ascent). */
  size?: FigureSize | number;
  tone?: FigureTone;
  /**
   * Override the theme colour, for a surface that is deliberately
   * theme-fixed (the white share card). Everything else uses `tone`.
   */
  tint?: string;
  /** Sits on a tinted ground (block intro) rather than the page. */
  onWash?: boolean;
  /** Breathe between the two keyframes (the hero figure only). */
  animate?: boolean;
  testID?: string;
}

export function MovementFigure({
  movementId,
  size = "row",
  tone = "ink",
  tint: tintOverride,
  onWash = false,
  animate = false,
  testID,
}: MovementFigureProps) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const source = movementFigure(movementId);
  const frames = movementFigureFrames(movementId);
  const looping = animate && !reduceMotion && frames !== null;
  const blend = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!looping) {
      blend.setValue(0);
      return;
    }
    const half = (toValue: number) =>
      Animated.timing(blend, {
        toValue,
        duration: FIGURE_LOOP_HALF_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([half(1), half(0)]));
    loop.start();
    return () => loop.stop();
  }, [looping, blend, movementId]);
  const box = typeof size === "number" ? size : DIMENSIONS[size];
  const tint =
    tintOverride ??
    (tone === "accent" ? colors.accent : tone === "soft" ? colors.inkSoft : colors.ink);
  // A missing figure renders nothing at all — a degraded build shows the
  // movement name, never a broken-image hole.
  if (!source) return null;
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.frame,
        { width: box, height: box },
        onWash && {
          backgroundColor: colors.accentSoft,
          borderRadius: radius.card,
          padding: spacing.sm,
        },
      ]}
    >
      {looping && frames ? (
        <>
          <Animated.Image
            source={frames[0]}
            resizeMode="contain"
            style={[
              styles.image,
              { tintColor: tint },
              { opacity: Animated.subtract(1, blend) },
            ]}
            testID={testID ? `${testID}-frame-a` : undefined}
          />
          <Animated.Image
            source={frames[1]}
            resizeMode="contain"
            style={[styles.image, styles.overlay, { tintColor: tint }, { opacity: blend }]}
            testID={testID ? `${testID}-frame-b` : undefined}
          />
        </>
      ) : (
        <Image
          source={source}
          resizeMode="contain"
          style={[styles.image, { tintColor: tint }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
  },
});
