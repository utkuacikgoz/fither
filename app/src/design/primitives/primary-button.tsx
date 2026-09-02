import { Pressable, StyleSheet } from "react-native";

import { useTheme } from "../theme";
import { minTouchTarget, onUnlock, radius, spacing, unlockBg } from "../tokens";
import { AppText } from "./app-text";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  /** "inverse" = bone pill with sage text, for the sage unlock screen. */
  tone?: "accent" | "inverse";
  testID?: string;
}

/**
 * The one call to action a screen is allowed. Sage pill, generous
 * height — reachable one-handed at the bottom of the screen. The label
 * colour comes from the THEME (theme.onAccent): bone on light's deep
 * sage, dark ink on dark's light sage — both ≥4.5:1. The inverse tone
 * exists only on the theme-independent sage unlock screen, so it pairs
 * the static unlock tokens (bone fill, deep-sage text, 5.05:1) in both
 * themes.
 */
export function PrimaryButton({
  label,
  onPress,
  tone = "accent",
  testID,
}: PrimaryButtonProps) {
  const colors = useTheme();
  const background = tone === "inverse" ? onUnlock : colors.accent;
  const textColor = tone === "inverse" ? unlockBg : colors.onAccent;
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <AppText variant="bodyLarge" color={textColor}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTouchTarget + spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
});
