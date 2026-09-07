import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { FadeIn } from "../../design/primitives/fade-in";
import { useTheme } from "../../design/theme";
import { hairline, motion, radius, spacing } from "../../design/tokens";

// The surface a settings group sits on: tile tone, hairline, card radius,
// and — unlike Card — no vertical padding, because its rows (SettingsRow,
// OptionRow) bring their own 56pt height and the hairlines between them
// do the separating. Horizontal padding is the ledger's 20pt. Enters
// with the same staggered ease-out rise as every hub surface.
//
// "panel" is the one exception: the erase confirm, a padded tile with a
// danger hairline (owner-approved erase-confirm mockup) instead of rows.

interface SettingsGroupProps {
  children: ReactNode;
  reduceMotion: boolean;
  /** Stagger index; the delay is index × motion.staggerMs (ADR-0013). */
  order?: number;
  variant?: "rows" | "panel";
  /** The panel's hairline: the line, or the danger colour for the erase confirm. */
  outline?: "line" | "danger";
  testID?: string;
}

export function SettingsGroup({
  children,
  reduceMotion,
  order = 0,
  variant = "rows",
  outline = "line",
  testID,
}: SettingsGroupProps) {
  const colors = useTheme();
  return (
    <FadeIn
      reduceMotion={reduceMotion}
      delayMs={order * motion.staggerMs}
      rise={motion.riseDistance}
    >
      <View
        testID={testID}
        style={[
          styles.group,
          variant === "panel" ? styles.panel : styles.rows,
          {
            backgroundColor: colors.surface,
            borderColor: outline === "danger" ? colors.danger : colors.line,
          },
        ]}
      >
        {children}
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radius.card,
    borderWidth: hairline,
  },
  rows: {
    paddingHorizontal: spacing.md + spacing.xs,
  },
  panel: {
    padding: spacing.md + spacing.xs,
    gap: spacing.sm + spacing.xs,
  },
});
