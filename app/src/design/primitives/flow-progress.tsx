import { StyleSheet, View } from "react-native";

import { Track } from "./track";

// Where she is in a short flow. The daily prompt is four questions in
// ten seconds, and before this the screen gave no clue how many were
// left — the one question a time-poor user actually has ("how long is
// this?") went unanswered, which is a conceptual-model gap, not a
// decoration one. Four segments answer it in no words and no taps: Gate
// 3's budget is untouched.
//
// The track itself is decorative; the meaning lives here, as the
// platform's own progress semantics rather than invented copy.

interface FlowProgressProps {
  /** Total steps, always from the flow's real structure. */
  total: number;
  /** Which step she is on, 1-based. Counted as reached — she is here. */
  current: number;
  reduceMotion: boolean;
  testID?: string;
}

export function FlowProgress({
  total,
  current,
  reduceMotion,
  testID,
}: FlowProgressProps) {
  return (
    <View
      style={styles.wrapper}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current }}
    >
      <Track
        steps={total}
        reached={current}
        reduceMotion={reduceMotion}
        {...(testID ? { filledTestID: `${testID}-filled` } : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // The track is 4pt tall; the row it sits in stays touchable-free and
    // quiet, never competing with the question below it.
    justifyContent: "center",
  },
});
