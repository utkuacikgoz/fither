import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { useTheme } from "../theme";
import { hairline, spacing } from "../tokens";
import { AppText } from "./app-text";

// The seven-day strip (owner brief 2026-09-07, wave 2; mockups home-week
// and weekly-recap): Monday first, a letter above a 34pt disc per day.
// A trained day is a filled green disc, today an outlined green ring, any
// other day a hairline ring. Days she did not train are simply not
// filled in (strings.week): nothing here names a gap.
//
// A pure rendering of the engine's week: the caller passes the seven
// dates from `weekOf`, the trained dates from `weekParticipation`, and
// today. The primitive decides nothing about what counts as trained.
//
// Accessibility: each day is one element, named by its weekday and
// stated as selected when trained, so VoiceOver walks the week the way
// the eye reads it. Static by design (ADR-0013): a strip is read, not
// watched, and the tile it sits on already enters with the page.

/** Disc diameter, on the 4pt grid: 32 + a hairline each side. */
const DISC = spacing.xl + hairline * 2;

interface WeekRowProps {
  /** The week's seven dates, Monday first (the engine's `Week.dates`). */
  dates: readonly string[];
  /** Dates in the week with a trained entry (`WeekParticipation.trainedDates`). */
  trainedDates: readonly string[];
  /** Today's local ISO date; drawn as a ring when it falls in the week. */
  today: string;
  testID?: string;
}

export function WeekRow({ dates, trainedDates, today, testID }: WeekRowProps) {
  const colors = useTheme();
  const trained = new Set(trainedDates);
  return (
    <View style={styles.row} testID={testID}>
      {dates.map((date, index) => {
        const isTrained = trained.has(date);
        const isToday = date === today;
        const dayTestID = testID ? `${testID}-day-${index}` : undefined;
        return (
          <View
            key={date}
            style={styles.day}
            accessible
            accessibilityLabel={strings.week.dayNames[index]}
            accessibilityState={{ selected: isTrained }}
            testID={dayTestID}
          >
            <AppText variant="caption" importantForAccessibility="no">
              {strings.week.dayLetters[index]}
            </AppText>
            <View
              style={[
                styles.disc,
                {
                  backgroundColor: isTrained ? colors.accent : colors.surface,
                  borderColor: isTrained || isToday ? colors.accent : colors.line,
                },
              ]}
              testID={
                dayTestID
                  ? `${dayTestID}-${isTrained ? "trained" : isToday ? "today" : "rest"}`
                  : undefined
              }
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  day: {
    flex: 1,
    alignItems: "center",
    gap: spacing.sm,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: hairline,
  },
});
