import { Pressable, StyleSheet } from "react-native";

import { useTheme } from "../theme";
import { minTouchTarget, spacing } from "../tokens";
import { AppText } from "./app-text";

interface QuietButtonProps {
  label: string;
  onPress: () => void;
  testID?: string;
}

/** A deliberately quiet text action (skip, secondary paths). Never competes. */
export function QuietButton({ label, onPress, testID }: QuietButtonProps) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
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
});
