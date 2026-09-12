import { StyleSheet, View } from "react-native";
import { weekOf } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { SectionCaption } from "../../design/primitives/section-caption";
import { Tile } from "../../design/primitives/tile";
import { WeekRow } from "../../design/primitives/week-row";
import { spacing } from "../../design/tokens";
import type { WeekView } from "../../state/week-view";

// This week on the hub (owner brief 2026-09-07, wave 2; mockup home-week,
// approved): one line about the week, then the seven-day strip (the
// shared WeekRow — a filled disc for a day she trained, the green ring
// on today). The whole tile opens the matching recap; it does not decide.
// The count, the trained dates and the verdict are the engine's, read
// through state/week-view.ts; this file only picks which line to set
// beside the strip. Days she did not train are simply not filled: no
// shortfall, no debt, no untrained day named (strings.week).

interface WeekTileProps {
  view: WeekView;
  /** The hub's reactive today, so the ring and the week agree. */
  today: string;
  order: number;
  reduceMotion: boolean;
  /** Opens the week whose progress this tile shows. */
  onPress: () => void;
}

/**
 * The tile's one sentence: the count against her target and the number
 * remaining while one remains; the target reached, once it is;
 * the plain count with no target set.
 */
function weekLine(view: WeekView): string {
  const { count } = view.participation;
  if (view.target === null) return strings.week.progressNoTarget(count);
  if (view.met) return strings.week.met(view.target);
  const progress = strings.week.progress(count, view.target);
  return view.remaining === null || view.remaining === 0
    ? progress
    : `${progress} ${strings.week.remaining(view.remaining)}`;
}

export function WeekTile({ view, today, order, reduceMotion, onPress }: WeekTileProps) {
  const { dates } = weekOf(today);
  return (
    <View>
      <SectionCaption label={strings.week.title} />
      <Tile order={order} reduceMotion={reduceMotion} testID="home-week-tile" onPress={onPress}>
        <AppText variant="body" testID="home-week-line">
          {weekLine(view)}
        </AppText>
        <View style={styles.days}>
          {/* The strip carries the brief's ids: home-week, home-week-day-<i>. */}
          <WeekRow
            dates={dates}
            trainedDates={view.participation.trainedDates}
            today={today}
            testID="home-week"
          />
        </View>
      </Tile>
    </View>
  );
}

const styles = StyleSheet.create({
  days: {
    marginTop: spacing.md,
  },
});
