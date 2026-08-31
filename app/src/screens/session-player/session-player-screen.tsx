import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useKeepAwake } from "expo-keep-awake";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { ProgressLine } from "../../design/primitives/progress-line";
import { QuietButton } from "../../design/primitives/quiet-button";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
import {
  isCountingDown,
  isFinished,
  progressFraction,
} from "../../session/player-machine";
import { useSessionStore } from "../../state/session-store";

// The session is sacred: movement name, one cue, one huge number, a thin
// progress line. Nothing else. No chrome, no points mid-set.

interface SessionPlayerScreenProps {
  onFinished: () => void;
}

export function SessionPlayerScreen({ onFinished }: SessionPlayerScreenProps) {
  useKeepAwake();
  const player = useSessionStore((s) => s.player);
  const dispatchPlayer = useSessionStore((s) => s.dispatchPlayer);

  const counting = player !== null && isCountingDown(player);
  const finished = player !== null && isFinished(player);

  useEffect(() => {
    if (!counting) return;
    const interval = setInterval(() => dispatchPlayer({ type: "tick" }), 1000);
    return () => clearInterval(interval);
  }, [counting, dispatchPlayer]);

  useEffect(() => {
    if (finished) onFinished();
  }, [finished, onFinished]);

  if (!player || player.phase.kind === "done") {
    return <Screen>{null}</Screen>;
  }

  const { phase } = player;
  const block = player.blocks[phase.blockIndex];
  if (!block) return <Screen>{null}</Screen>;

  return (
    <Screen>
      <ProgressLine testID="session-progress" fraction={progressFraction(player)} />

      {phase.kind === "blockIntro" && (
        <>
          <View style={styles.center}>
            <AppText variant="display">{block.name}</AppText>
            <AppText variant="bodySoft" style={styles.subline}>
              {strings.player.blockPlan(
                block.sets,
                block.amount,
                block.timingType === "seconds",
              )}
            </AppText>
          </View>
          <View style={styles.bottom}>
            <PrimaryButton
              testID="player-begin"
              label={strings.player.begin}
              onPress={() => dispatchPlayer({ type: "begin" })}
            />
            <QuietButton
              testID="player-skip"
              label={strings.player.skipBlock}
              onPress={() => dispatchPlayer({ type: "skipBlock" })}
            />
          </View>
        </>
      )}

      {phase.kind === "work" && (
        <>
          <View style={styles.top}>
            <AppText variant="title">{block.name}</AppText>
            {block.cue.length > 0 && (
              <AppText variant="bodySoft" style={styles.subline}>
                {block.cue}
              </AppText>
            )}
          </View>
          <View style={styles.center}>
            <AppText variant="numeral" testID="player-numeral">
              {phase.remainingSeconds ?? block.amount}
            </AppText>
            <AppText variant="caption">
              {block.timingType === "seconds"
                ? strings.player.holdLabel
                : strings.player.repsLabel}
            </AppText>
            <AppText variant="caption" style={styles.setCounter}>
              {strings.player.setCounter(phase.setIndex + 1, block.sets)}
            </AppText>
          </View>
          <View style={styles.bottom}>
            {phase.remainingSeconds === null && (
              <PrimaryButton
                testID="player-set-done"
                label={strings.player.setDone}
                onPress={() => dispatchPlayer({ type: "advance" })}
              />
            )}
            <QuietButton
              testID="player-skip"
              label={strings.player.skipBlock}
              onPress={() => dispatchPlayer({ type: "skipBlock" })}
            />
          </View>
        </>
      )}

      {phase.kind === "rest" && (
        <View style={styles.center}>
          <AppText variant="title">{strings.player.rest}</AppText>
          <AppText variant="numeral" testID="player-numeral" style={styles.restNumeral}>
            {phase.remainingSeconds}
          </AppText>
          <AppText variant="caption">{strings.player.restNote}</AppText>
        </View>
      )}

      {phase.kind === "feedback" && (
        <>
          <View style={styles.top}>
            <AppText variant="title">{strings.player.feedback.question}</AppText>
          </View>
          <View style={styles.bottom}>
            <RowButton
              testID="feedback-completed"
              label={strings.player.feedback.completed}
              onPress={() => dispatchPlayer({ type: "feedback", outcome: "completed" })}
            />
            <RowButton
              testID="feedback-struggled"
              label={strings.player.feedback.struggled}
              onPress={() => dispatchPlayer({ type: "feedback", outcome: "struggled" })}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    marginTop: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  bottom: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  subline: {
    marginTop: spacing.sm,
  },
  setCounter: {
    marginTop: spacing.md,
  },
  restNumeral: {
    marginVertical: spacing.md,
  },
});
