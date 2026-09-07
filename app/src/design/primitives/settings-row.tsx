import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { hairline, spacing } from "../tokens";
import { AppText } from "./app-text";

// The grouped-list row (owner-approved Settings, 2026-09-06 round 6): a
// label at the left, the current value at the right in the soft ink, and
// a chevron when the row opens a subpage. 56pt tall so a group of them
// sits on the 4pt grid with one gap value; a hairline separates siblings
// inside a surface group, so the group is the container and the rows
// carry no border of their own (the same reasoning as OptionRow).
//
// Norman: a row with a chevron looks like a row that navigates
// (affordance); the value sits on the row it describes (mapping); the
// destructive row wears the danger colour so it is never mistaken for
// its neighbours (signifiers). A row without onPress is a plain fact
// (the subscription page's Plan / Price) and renders as a View, not a
// button — nothing decorative is dressed as a control.

/** Row height: 56pt, the ledger's row unit for a tile. */
export const SETTINGS_ROW_HEIGHT = spacing.xxl + spacing.sm;

// The chevron is drawn, not typed: two hairline edges of a small square
// turned 45°, in the soft ink — no glyph string to audit, one asset-free
// affordance that tints with the theme.
const CHEVRON_SIZE = spacing.sm;
const CHEVRON_STROKE = hairline * 1.5;

interface SettingsRowProps {
  label: string;
  /** The current setting, stated flat, at the right. */
  value?: string;
  /** Present on a row that opens a subpage. */
  chevron?: boolean;
  /** "danger" is for the one destructive row (erase everything). */
  tone?: "default" | "danger";
  /** Absent on a row that only states a fact. */
  onPress?: () => void;
  /** Hairline under the row. False on a group's last row. */
  divider?: boolean;
  testID?: string;
}

export function SettingsRow({
  label,
  value,
  chevron = false,
  tone = "default",
  onPress,
  divider = true,
  testID,
}: SettingsRowProps) {
  const colors = useTheme();
  const rule = divider
    ? { borderBottomWidth: hairline, borderBottomColor: colors.line }
    : null;
  const content = (
    <>
      <AppText
        variant="body"
        color={tone === "danger" ? colors.danger : colors.ink}
        style={styles.label}
      >
        {label}
      </AppText>
      {value !== undefined && (
        <AppText
          variant="body"
          color={colors.inkSoft}
          style={styles.value}
          numberOfLines={1}
          testID={testID ? `${testID}-value` : undefined}
        >
          {value}
        </AppText>
      )}
      {chevron && (
        <View
          style={[styles.chevron, { borderColor: colors.inkSoft }]}
          importantForAccessibility="no"
          accessibilityElementsHidden
          testID={testID ? `${testID}-chevron` : undefined}
        />
      )}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, rule]} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      {...(value !== undefined ? { accessibilityValue: { text: value } } : {})}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, rule, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: SETTINGS_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + spacing.xs,
  },
  label: {
    flex: 1,
  },
  value: {
    flexShrink: 1,
  },
  chevron: {
    width: CHEVRON_SIZE,
    height: CHEVRON_SIZE,
    borderRightWidth: CHEVRON_STROKE,
    borderTopWidth: CHEVRON_STROKE,
    transform: [{ rotate: "45deg" }],
    marginRight: spacing.xs,
  },
});
