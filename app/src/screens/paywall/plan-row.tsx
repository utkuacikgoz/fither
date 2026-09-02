import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../../design/theme";
import {
  glyph,
  hairline,
  minTouchTarget,
  radius,
  spacing,
} from "../../design/tokens";
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
 * One subscription plan as a calm surface card: hairline border, name
 * left, price plainly set on the same line — the price lives on the plan
 * it prices. Selection reads three ways at once (sage wash, accent
 * border, check glyph): these rows are "tapped and staying" while she
 * reads on, the same grammar as the multi-select rows. The check slot is
 * always reserved so the prices keep their alignment and nothing jumps
 * when the choice moves. Both plans share this exact anatomy — annual
 * leads by order and preselection, never by shrinking monthly. No
 * badges, no strikethroughs, no "save X%" theatrics — the paywall is an
 * honest letter.
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
        styles.card,
        {
          backgroundColor:
            selected || pressed ? colors.accentSoft : colors.surface,
          borderColor: selected ? colors.accent : colors.line,
        },
      ]}
    >
      <View style={styles.topLine}>
        <AppText variant="bodyLarge" style={styles.label}>
          {label}
        </AppText>
        <AppText variant="bodyLarge">{price}</AppText>
        <View style={styles.checkSlot}>
          {selected && (
            // Decorative: selection is announced via accessibilityState.
            <AppText
              variant="bodyLarge"
              color={colors.accent}
              importantForAccessibility="no"
              testID={testID ? `${testID}-check` : undefined}
            >
              {glyph.check}
            </AppText>
          )}
        </View>
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
  card: {
    minHeight: minTouchTarget + spacing.md,
    borderRadius: radius.card,
    borderWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    flex: 1,
  },
  checkSlot: {
    width: spacing.lg,
    alignItems: "flex-end",
  },
  note: {
    marginTop: spacing.xs,
  },
});
