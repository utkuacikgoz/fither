import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
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
      // A View is an accessibility element only when told so; without
      // `accessible` VoiceOver skipped this entirely (reviewer blocker).
      // The value starts at 0 so question one reads as the start, not
      // as a quarter already done.
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={strings.prompt.progressLabel}
      accessibilityValue={{ min: 0, max: total, now: current }}
    >
      <Track
        steps={total}
        reached={current}
        reduceMotion={reduceMotion}
        {...(testID
          ? { testID: `${testID}-track`, filledTestID: `${testID}-filled` }
          : {})}
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
