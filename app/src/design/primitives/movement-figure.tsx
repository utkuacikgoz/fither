import { Image, StyleSheet, View } from "react-native";

import { movementFigure } from "../../session/movement-figures";
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
  testID?: string;
}

export function MovementFigure({
  movementId,
  size = "row",
  tone = "ink",
  tint: tintOverride,
  onWash = false,
  testID,
}: MovementFigureProps) {
  const colors = useTheme();
  const source = movementFigure(movementId);
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
      <Image
        source={source}
        resizeMode="contain"
        style={[styles.image, { tintColor: tint }]}
      />
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
});
