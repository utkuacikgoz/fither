import { StyleSheet } from "react-native";

import { useTheme } from "../theme";
import { minTouchTarget, onUnlock, radius, spacing, unlockBg } from "../tokens";
import { AppText } from "./app-text";
import { PressSurface } from "./press-surface";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  /** White on black for the theme-fixed unlock screen. */
  tone?: "accent" | "inverse";
  testID?: string;
  reduceMotion?: boolean;
  disabled?: boolean;
  busy?: boolean;
}

/** Generous primary action with theme-safe contrast and immediate feedback. */
export function PrimaryButton({
  label,
  onPress,
  tone = "accent",
  testID,
  reduceMotion = true,
  disabled = false,
  busy = false,
}: PrimaryButtonProps) {
  const colors = useTheme();
  const background = tone === "inverse" ? onUnlock : colors.accent;
  const textColor = tone === "inverse" ? unlockBg : colors.onAccent;
  return (
    <PressSurface
      reduceMotion={reduceMotion}
      disabled={disabled || busy}
      accessibilityState={{ disabled: disabled || busy, busy }}
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled && !busy ? 0.6 : reduceMotion && pressed ? 0.88 : 1 },
      ]}
    >
      <AppText variant="bodyLarge" color={textColor} style={styles.label}>
        {label}
      </AppText>
    </PressSurface>
  );
}

const styles = StyleSheet.create({
  label: { textAlign: "center" },
  button: {
    minHeight: minTouchTarget + spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
});
