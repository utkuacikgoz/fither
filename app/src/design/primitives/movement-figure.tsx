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

type FigureSize = "row" | "hero";

const DIMENSIONS: Record<FigureSize, number> = {
  row: 56,
  hero: 200,
};

interface MovementFigureProps {
  movementId: string;
  size?: FigureSize;
  /** Sits on a tinted ground (block intro) rather than the page. */
  onWash?: boolean;
  testID?: string;
}

export function MovementFigure({
  movementId,
  size = "row",
  onWash = false,
  testID,
}: MovementFigureProps) {
  const colors = useTheme();
  const source = movementFigure(movementId);
  const box = DIMENSIONS[size];
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
        style={[styles.image, { tintColor: colors.accent }]}
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
