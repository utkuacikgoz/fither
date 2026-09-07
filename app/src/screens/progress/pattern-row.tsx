import { StyleSheet, View } from "react-native";
import { MAX_TIER, type Pattern, type Tier } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { useTheme } from "../../design/theme";
import { fontFamily, hairline, spacing } from "../../design/tokens";
import { TierTrack } from "./tier-track";

// One pattern in the Patterns list (round 6): the figure of the movement
// she is on now, the pattern's noun with that movement named beneath, a
// short ladder, and the tier as a numeral. Rows are hairline-separated
// inside a list tile; the first row carries no rule.
//
// The row is one accessible element and speaks the full tier line
// ("Tier 2 of 6", strings.profile.tier) — the visible numeral is the
// mockup's short form, the track is decorative, and the movement name
// comes from the library through the caller (session/skill-name.ts).

interface PatternRowProps {
  pattern: Pattern;
  tier: Tier;
  /** The id and name of the ladder movement at her current tier. */
  movementId: string;
  movementName: string;
  first: boolean;
  reduceMotion: boolean;
  /** When the tile holding this row has finished entering. */
  baseDelayMs: number;
}

export function PatternRow({
  pattern,
  tier,
  movementId,
  movementName,
  first,
  reduceMotion,
  baseDelayMs,
}: PatternRowProps) {
  const colors = useTheme();
  const name = strings.profile.patterns.names[pattern];
  return (
    <View
      style={[styles.row, !first && { borderTopWidth: hairline, borderTopColor: colors.line }]}
      accessible
      accessibilityLabel={[name, strings.profile.tier(tier, MAX_TIER), movementName].join(". ")}
      testID={`pattern-${pattern}`}
    >
      <MovementFigure movementId={movementId} size="small" tone="ink" />
      <View style={styles.text}>
        <AppText variant="body" style={styles.name}>
          {name}
        </AppText>
        <AppText variant="caption" numberOfLines={1} testID={`pattern-${pattern}-movement`}>
          {movementName}
        </AppText>
      </View>
      <View style={styles.track}>
        <TierTrack
          pattern={pattern}
          tier={tier}
          reduceMotion={reduceMotion}
          baseDelayMs={baseDelayMs}
        />
      </View>
      <AppText variant="body" style={styles.tier} testID={`pattern-${pattern}-tier`}>
        {String(tier)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: spacing.xxxl,
    paddingVertical: spacing.sm,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs / 2,
  },
  name: {
    fontFamily: fontFamily.semibold,
  },
  track: {
    width: spacing.xxxl + spacing.sm,
  },
  tier: {
    fontFamily: fontFamily.semibold,
    minWidth: spacing.lg,
    textAlign: "right",
  },
});
