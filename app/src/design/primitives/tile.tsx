import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../theme";
import { hairline, motion, radius, spacing } from "../tokens";
import { FadeIn } from "./fade-in";

// The grouped-list tile (owner feedback ledger, rounds 5 and 6): the
// surface the Progress hero numerals, the next-skill tile and the
// pattern list sit on. Same skin as Card — surface, hairline, 16pt
// radius, staggered ease-out entrance — but a tighter inset, because
// the caption that names a tile now sits OUTSIDE it, so the tile no
// longer pads for a heading of its own. Card keeps its 24pt inset for
// the hub's self-captioned cards; folding the two into one primitive is
// a follow-up, not a decision this file makes.

type TileInset = "content" | "list";

interface TileProps {
  children: ReactNode;
  /**
   * "content" (default) is the 16/20pt inset of a tile that holds set
   * content (a numeral, a figure and its lines). "list" drops the
   * vertical inset: rows carry their own height and the hairlines
   * between them run to the tile's edge.
   */
  inset?: TileInset;
  /** Stagger index; the delay is index × motion.staggerMs (ADR-0013). */
  order?: number;
  reduceMotion: boolean;
  /** Layout of the tile in its row (e.g. flex: 1 for two side by side). */
  style?: StyleProp<ViewStyle>;
  /** Set when the tile is one accessible element (a stat read as one line). */
  accessible?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function Tile({
  children,
  inset = "content",
  order = 0,
  reduceMotion,
  style,
  accessible,
  accessibilityLabel,
  testID,
}: TileProps) {
  const colors = useTheme();
  return (
    <FadeIn
      reduceMotion={reduceMotion}
      delayMs={order * motion.staggerMs}
      rise={motion.riseDistance}
      style={style}
    >
      <View
        style={[
          styles.tile,
          inset === "list" ? styles.listInset : styles.contentInset,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {children}
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.card,
    borderWidth: hairline,
    // One gap value per axis inside a tile (ledger, round 5).
    paddingHorizontal: spacing.md + spacing.xs,
  },
  contentInset: {
    paddingVertical: spacing.md,
  },
  listInset: {
    paddingVertical: 0,
  },
});
