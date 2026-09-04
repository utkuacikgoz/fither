import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { FadeIn } from "../../design/primitives/fade-in";
import { useTheme } from "../../design/theme";
import { hairline, motion, radius, spacing } from "../../design/tokens";

interface HomeCardProps {
  children: ReactNode;
  /**
   * "hero" is the sage wash the day's card wears — one per screen, so the
   * focal point is unmistakable. Everything else is a plain surface card.
   */
  tone?: "surface" | "hero";
  /** Stagger index; the delay is index × motion.staggerMs (ADR-0013). */
  order?: number;
  reduceMotion: boolean;
  /** Present only on cards that ARE a door — a card that navigates. */
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * The home hub's card: surface (or sage wash), hairline, 16pt radius,
 * generous padding, and a staggered ease-out fade+rise on mount. A card
 * with onPress is a door and says so (accessibilityRole="button", press
 * feedback); a card without one is just information.
 */
export function HomeCard({
  children,
  tone = "surface",
  order = 0,
  reduceMotion,
  onPress,
  accessibilityLabel,
  testID,
}: HomeCardProps) {
  const colors = useTheme();
  const surface = [
    styles.card,
    {
      backgroundColor: tone === "hero" ? colors.accentSoft : colors.surface,
      borderColor: colors.line,
    },
  ];
  return (
    <FadeIn
      reduceMotion={reduceMotion}
      delayMs={order * motion.staggerMs}
      rise={motion.riseDistance}
      style={styles.wrapper}
    >
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          onPress={onPress}
          style={({ pressed }) => [...surface, { opacity: pressed ? 0.88 : 1 }]}
        >
          {children}
        </Pressable>
      ) : (
        <View style={surface} testID={testID}>
          {children}
        </View>
      )}
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: hairline,
    padding: spacing.lg,
  },
});
