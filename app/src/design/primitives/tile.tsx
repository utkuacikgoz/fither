import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

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
  /**
   * The surface fills its slot: two tiles side by side share one height
   * whatever their lines wrap to (owner feedback 2026-09-08, Progress:
   * the streak and points tiles ended at different heights).
   */
  fill?: boolean;
  /** Set when the tile is one accessible element (a stat read as one line). */
  accessible?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  /** Present only when the whole tile opens another surface. */
  onPress?: () => void;
}

export function Tile({
  children,
  inset = "content",
  order = 0,
  reduceMotion,
  style,
  fill = false,
  accessible,
  accessibilityLabel,
  testID,
  onPress,
}: TileProps) {
  const colors = useTheme();
  const surface = [
    styles.tile,
    inset === "list" ? styles.listInset : styles.contentInset,
    fill && styles.fill,
    { backgroundColor: colors.surface, borderColor: colors.line },
  ];
  return (
    <FadeIn
      reduceMotion={reduceMotion}
      delayMs={order * motion.staggerMs}
      rise={motion.riseDistance}
      style={style}
    >
      {onPress ? (
        <Pressable
          style={({ pressed }) => [...surface, { opacity: pressed ? 0.88 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          onPress={onPress}
        >
          {children}
        </Pressable>
      ) : (
        <View
          style={surface}
          accessible={accessible}
          accessibilityLabel={accessibilityLabel}
          testID={testID}
        >
          {children}
        </View>
      )}
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
  fill: {
    flex: 1,
  },
});
