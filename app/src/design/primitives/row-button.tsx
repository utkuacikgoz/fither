import { Pressable, StyleSheet } from "react-native";

import { useTheme } from "../theme";
import { hairline, minTouchTarget, radius, spacing } from "../tokens";
import { AppText } from "./app-text";

interface RowButtonProps {
  label: string;
  onPress: () => void;
  selected?: boolean;
  testID?: string;
}

/**
 * Full-width tappable row — the daily-prompt answer unit. Calm rows,
 * not tiny chips. 44pt+ touch target, hairline border, sage wash when
 * selected.
 */
export function RowButton({ label, onPress, selected = false, testID }: RowButtonProps) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected
            ? colors.accentSoft
            : pressed
              ? colors.accentSoft
              : colors.surface,
          borderColor: selected ? colors.accent : colors.line,
        },
      ]}
    >
      <AppText variant="bodyLarge">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget + spacing.md,
    borderRadius: radius.card,
    borderWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: "center",
    marginBottom: spacing.sm + spacing.xs,
  },
});
