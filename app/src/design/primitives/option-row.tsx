import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { glyph, hairline, minTouchTarget, spacing } from "../tokens";
import { AppText } from "./app-text";

interface OptionRowProps {
  label: string;
  onPress: () => void;
  /**
   * Settings choices persist and are never auto-advanced away from, so
   * selection ALWAYS carries a visible check — unlike the daily prompt's
   * RowButton, where a single-select tap leaves the screen immediately
   * and a check would flash for a frame. Norman's signifiers: the state
   * she set months ago must be readable at a glance.
   */
  selected?: boolean;
  /** An action row (restore, a dev tool) rather than a choice: no state. */
  emphasis?: "option" | "action";
  /** Hairline under the row. False on a group's last row. */
  divider?: boolean;
  testID?: string;
}

/**
 * One row inside a Card group — the settings unit. No border of its own:
 * the card is the container and hairlines separate siblings, so a screen
 * of options reads as grouped lists rather than a stack of identical
 * boxes (which is what the owner saw and called weird).
 *
 * RowButton stays the daily-prompt/onboarding answer unit and is
 * unchanged; the two look different because they mean different things —
 * one is a decision the screen exists for, this is a preference.
 */
export function OptionRow({
  label,
  onPress,
  selected = false,
  emphasis = "option",
  divider = true,
  testID,
}: OptionRowProps) {
  const colors = useTheme();
  const labelColor =
    emphasis === "action" || selected ? colors.accent : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      // An action row (restore) has no state to announce; "not selected"
      // on a verb is noise (reviewer note).
      {...(emphasis === "action" ? {} : { accessibilityState: { selected } })}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && { borderBottomWidth: hairline, borderBottomColor: colors.line },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <AppText variant="body" color={labelColor} style={styles.label}>
        {label}
      </AppText>
      {selected && (
        // Decorative: selection is already announced via accessibilityState.
        <View style={styles.check}>
          <AppText
            variant="body"
            color={colors.accent}
            importantForAccessibility="no"
            accessibilityElementsHidden
            testID={testID ? `${testID}-check` : undefined}
          >
            {glyph.check}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  label: {
    flexShrink: 1,
  },
  check: {
    paddingLeft: spacing.md,
  },
});
