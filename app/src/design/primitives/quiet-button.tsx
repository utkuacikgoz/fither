import { Pressable, StyleSheet } from "react-native";

import { useTheme } from "../theme";
import { hairline, minTouchTarget, radius, spacing } from "../tokens";
import { AppText } from "./app-text";

interface QuietButtonProps {
  label: string;
  onPress: () => void;
  testID?: string;
  /**
   * Audit polish: bare soft text can read as a sibling of non-interactive
   * labels (the prompt's corner doors next to "Today"). `outlined` adds a
   * hairline pill — enough affordance to read as tappable, still quiet
   * enough never to compete with the screen's one decision.
   */
  outlined?: boolean;
  /**
   * The second state of a two-tap control — the player's skip (owner
   * decision 2026-09-12, after the confirmation screen was deleted). The
   * same quiet button, visibly changed: the accentSoft fill this product
   * already uses for a chosen row (row-button, area-grid, plan-row) with
   * the label in the accent. It reads as changed from the floor without a
   * new colour and without becoming the loudest thing on the screen. The
   * caller swaps the label too — the look alone never carries the
   * meaning.
   */
  armed?: boolean;
}

/** A deliberately quiet text action (skip, secondary paths). Never competes. */
export function QuietButton({
  label,
  onPress,
  testID,
  outlined = false,
  armed = false,
}: QuietButtonProps) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        // A sage hairline, not `line`: on the hero card's wash `line` was
        // 1.08:1 — the pill that is this button's whole affordance
        // vanished exactly where it is used (reviewer should-fix). The
        // accent hairline is 3:1+ on wash, surface and bone alike.
        outlined && [styles.outlined, { borderColor: colors.accent }],
        armed && [
          styles.outlined,
          { borderColor: colors.accent, backgroundColor: colors.accentSoft },
        ],
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <AppText variant="body" color={armed ? colors.accent : colors.inkSoft}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  outlined: {
    borderWidth: hairline,
    borderRadius: radius.pill,
  },
});
