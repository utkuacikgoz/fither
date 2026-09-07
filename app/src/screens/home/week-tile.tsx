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
// on today). Not a door — nothing here navigates, nothing here decides.
// The count, the trained dates and the verdict are the engine's, read
// through state/week-view.ts; this file only picks which line to set
// and which day name to put in it. Days she did not train are simply
// not filled: no shortfall, no debt, no untrained day named
// (strings.week).

interface WeekTileProps {
  view: WeekView;
  /** The hub's reactive today, so the ring and the week agree. */
  today: string;
  order: number;
  reduceMotion: boolean;
}

/**
 * The tile's one sentence: the count against her target and the day
 * that is next while one remains; the target reached, once it is; the
 * plain count with no target set.
 */
function weekLine(view: WeekView, dates: readonly string[]): string {
  const { count } = view.participation;
  if (view.target === null) return strings.week.progressNoTarget(count);
  if (view.met) return strings.week.met(view.target);
  const progress = strings.week.progress(count, view.target);
  const nextIndex =
    view.nextTrainingDay === null ? -1 : dates.indexOf(view.nextTrainingDay);
  const nextName = strings.week.dayNames[nextIndex];
  return nextName === undefined ? progress : `${progress} ${strings.week.nextLine(nextName)}`;
}

export function WeekTile({ view, today, order, reduceMotion }: WeekTileProps) {
  const { dates } = weekOf(today);
  return (
    <View>
      <SectionCaption label={strings.week.title} />
      <Tile order={order} reduceMotion={reduceMotion} testID="home-week-tile">
        <AppText variant="body" testID="home-week-line">
          {weekLine(view, dates)}
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
