import { StyleSheet, View } from "react-native";

import { useTheme } from "../../design/theme";
import {
  glyph,
  hairline,
  minTouchTarget,
  radius,
  spacing,
} from "../../design/tokens";
import { AppText } from "../../design/primitives/app-text";
import { PressSurface } from "../../design/primitives/press-surface";

interface PlanRowProps {
  label: string;
  price: string;
  /** Plain arithmetic on the real price — never a discount theatric. */
  note?: string | undefined;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  reduceMotion?: boolean;
  disabled?: boolean;
}

/**
 * One subscription plan as a calm surface card: hairline border, name
 * above the price, with room for both to scale. Selection reads three
 * ways at once (green wash, accent
 * border, check glyph): these rows are "tapped and staying" while she
 * reads on, the same grammar as the multi-select rows. The check slot is
 * always reserved so the prices keep their alignment and nothing jumps
 * when the choice moves. Both plans share this exact anatomy — annual
 * leads by order and preselection, never by shrinking monthly. No
 * badges, no strikethroughs, no "save X%" theatrics — the paywall is an
 * honest letter.
 */
export function PlanRow({ label, price, note, selected, onPress, testID, reduceMotion = true, disabled = false }: PlanRowProps) {
  const colors = useTheme();
  return (
    <PressSurface
      reduceMotion={reduceMotion}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
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
        <View style={styles.planText}>
          <AppText variant="body" color={colors.inkSoft}>{label}</AppText>
          <AppText variant="bodyLarge">{price}</AppText>
        </View>
        <View style={styles.checkSlot}>
          {selected && (
            // Decorative: selection is announced via accessibilityState.
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
        </View>
      </View>
      {note ? (
        <AppText variant="bodySoft" style={styles.note}>
          {note}
        </AppText>
      ) : null}
    </PressSurface>
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
  planText: {
    flex: 1,
    gap: spacing.xs,
  },
  checkSlot: {
    width: spacing.lg,
    alignItems: "flex-end",
  },
  note: {
    marginTop: spacing.xs,
  },
});
