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
}

/** A deliberately quiet text action (skip, secondary paths). Never competes. */
export function QuietButton({
  label,
  onPress,
  testID,
  outlined = false,
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
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <AppText variant="body" color={colors.inkSoft}>
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
