import { Pressable, StyleSheet } from "react-native";

import { useTheme } from "../theme";
import { minTouchTarget, onAccent, radius, spacing } from "../tokens";
import { AppText } from "./app-text";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  /** "inverse" = bone pill with sage text, for the sage unlock screen. */
  tone?: "accent" | "inverse";
  testID?: string;
}

/**
 * The one call to action a screen is allowed. Sage pill, bone text,
 * generous height — reachable one-handed at the bottom of the screen.
 */
export function PrimaryButton({
  label,
  onPress,
  tone = "accent",
  testID,
}: PrimaryButtonProps) {
  const colors = useTheme();
  const background = tone === "inverse" ? onAccent : colors.accent;
  const textColor = tone === "inverse" ? colors.accent : onAccent;
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
