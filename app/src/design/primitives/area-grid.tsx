import { Pressable, StyleSheet, View } from "react-native";
import type { BodyArea } from "@fither/engine";

import { strings } from "../../copy/strings";
import { useTheme } from "../theme";
import { glyph, hairline, minTouchTarget, radius, spacing } from "../tokens";
import { AppText } from "./app-text";

// The body-area picker (ADR-0017, owner-approved 2026-09-06): the eight
// areas as a two-column grid of chips, so the whole choice sits above
// the fold on a small phone instead of eight full-width rows. Multi-
// select: a chosen chip fills with the low-emphasis green, takes the
// accent hairline and shows the check. Shared by onboarding's permanent
// list and the prompt's daily soreness step — one control, one meaning.

interface AreaGridProps {
  areas: readonly BodyArea[];
  selected: readonly BodyArea[];
  onToggle: (area: BodyArea) => void;
  /** Per-chip testIDs are `${testIDPrefix}-${area}` (+ `-check` when selected). */
  testIDPrefix: string;
}

export function AreaGrid({ areas, selected, onToggle, testIDPrefix }: AreaGridProps) {
  const colors = useTheme();
  return (
    <View style={styles.grid}>
      {areas.map((area) => {
        const isSelected = selected.includes(area);
        const testID = `${testIDPrefix}-${area}`;
        return (
          <Pressable
            key={area}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            testID={testID}
            onPress={() => onToggle(area)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: isSelected || pressed ? colors.accentSoft : colors.surface,
                borderColor: isSelected ? colors.accent : colors.line,
              },
            ]}
          >
            <AppText variant="bodyLarge" style={styles.label}>
              {strings.prompt.soreness.areas[area]}
            </AppText>
            {isSelected && (
              <AppText
                variant="bodyLarge"
                color={colors.accent}
                importantForAccessibility="no"
                accessibilityElementsHidden
                testID={`${testID}-check`}
              >
                {glyph.check}
              </AppText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm + spacing.xs,
  },
  chip: {
    // Two per row: half the width minus half the gap, on the 4pt grid.
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: minTouchTarget + spacing.md + spacing.xs,
    borderRadius: radius.card,
    borderWidth: hairline,
    paddingHorizontal: spacing.md + spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  label: {
    flexShrink: 1,
  },
});
