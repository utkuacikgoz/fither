import { StyleSheet } from "react-native";

import { useTheme } from "../theme";
import { glyph, hairline, minTouchTarget, radius, spacing } from "../tokens";
import { AppText } from "./app-text";
import { MovementFigure } from "./movement-figure";
import { PressSurface } from "./press-surface";

interface RowButtonProps {
  label: string;
  onPress: () => void;
  selected?: boolean;
  /**
   * A movement id whose figure leads the row — for an answer that IS a
   * kind of training (onboarding's floor-or-chair), so the option shows
   * what it means rather than describing it (Norman: mapping). Absent on
   * every other row; the figure is decorative and the label carries it.
   */
  figure?: string;
  /**
   * Multi-select rows (soreness picks, the onboarding avoid-list) show a
   * check glyph while selected, so "tapped and staying" reads at a
   * glance. Single-select rows auto-advance and never need it.
   */
  multiSelect?: boolean;
  testID?: string;
  reduceMotion?: boolean;
}

/**
 * Full-width tappable row — the daily-prompt answer unit. Calm rows,
 * not tiny chips. 44pt+ touch target, hairline border, sage wash when
 * selected.
 */
export function RowButton({
  label,
  onPress,
  selected = false,
  multiSelect = false,
  figure,
  testID,
  reduceMotion = true,
}: RowButtonProps) {
  const colors = useTheme();
  return (
    <PressSurface
      reduceMotion={reduceMotion}
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
      {figure !== undefined && <MovementFigure movementId={figure} />}
      <AppText variant="bodyLarge" style={styles.label}>
        {label}
      </AppText>
      {multiSelect && selected && (
        // Decorative: selection is already announced via accessibilityState.
        <AppText
          variant="bodyLarge"
          color={colors.accent}
          importantForAccessibility="no"
          accessibilityElementsHidden
          testID={testID ? `${testID}-check` : undefined}
        >
          {glyph.check}
        </AppText>
      )}
    </PressSurface>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget + spacing.md,
    borderRadius: radius.card,
    borderWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm + spacing.xs,
  },
  label: {
    flex: 1,
  },
});
