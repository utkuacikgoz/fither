import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../../design/theme";
import { hairline, minTouchTarget, radius, spacing } from "../../design/tokens";
import { AppText } from "../../design/primitives/app-text";

interface PlanRowProps {
  label: string;
  price: string;
  /** Plain arithmetic on the real price — never a discount theatric. */
  note?: string | undefined;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * One subscription plan as a calm, full-width row: name and price plainly
 * set, sage wash when selected. No badges, no strikethroughs, no "save
 * X%" theatrics — the paywall is an honest letter.
 */
export function PlanRow({ label, price, note, selected, onPress, testID }: PlanRowProps) {
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
          backgroundColor:
            selected || pressed ? colors.accentSoft : colors.surface,
          borderColor: selected ? colors.accent : colors.line,
        },
      ]}
    >
      <View style={styles.topLine}>
        <AppText variant="bodyLarge">{label}</AppText>
        <AppText variant="bodyLarge">{price}</AppText>
      </View>
      {note ? (
        <AppText variant="bodySoft" style={styles.note}>
          {note}
        </AppText>
      ) : null}
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
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  note: {
    marginTop: spacing.xs,
  },
});
