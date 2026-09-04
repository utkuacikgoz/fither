import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { hairline, motion, radius, spacing } from "../tokens";
import { FadeIn } from "./fade-in";

interface CardProps {
  children: ReactNode;
  /**
   * "hero" is the sage wash the screen's one focal card wears — at most
   * one per screen, so the focal point is unmistakable. Everything else
   * is a plain surface card. A card holding sage-washed content of its
   * own (a tier track, a selected row) must stay "surface": wash on wash
   * erases the very contrast that content uses to say "reached".
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
 * The app's card (ADR-0013): surface (or sage wash), hairline, 16pt
 * radius, generous padding, and a staggered ease-out fade+rise on mount.
 * A card with onPress is a door and says so (accessibilityRole="button",
 * press feedback); a card without one is just information.
 *
 * Shared by every hub surface — home, progress, settings — so the three
 * tabs read as one product rather than three sketches.
 */
export function Card({
  children,
  tone = "surface",
  order = 0,
  reduceMotion,
  onPress,
  accessibilityLabel,
  testID,
}: CardProps) {
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
