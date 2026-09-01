import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useKeepAwake } from "expo-keep-awake";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { ProgressLine } from "../../design/primitives/progress-line";
import { QuietButton } from "../../design/primitives/quiet-button";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { minTouchTarget, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import {
  isCountingDown,
  isFinished,
  progressFraction,
} from "../../session/player-machine";
import { useSessionStore } from "../../state/session-store";

// The session is sacred: movement name, one cue, one huge number, a thin
// progress line. Nothing else. No chrome, no points mid-set.

/**
 * On a block intro she sees the movement first; the quiet exit appears
 * only after this long (2026-09-01 live-testing pass). UI pacing only —
 * no session rule hangs off this number. Work and rest keep their skip
 * visible from the start, unchanged.
 */
export const SKIP_REVEAL_DELAY_MS = 8000;

interface SessionPlayerScreenProps {
  onFinished: () => void;
}

export function SessionPlayerScreen({ onFinished }: SessionPlayerScreenProps) {
  useKeepAwake();
  const player = useSessionStore((s) => s.player);
  const dispatchPlayer = useSessionStore((s) => s.dispatchPlayer);
  const reduceMotion = useReducedMotion();

  const counting = player !== null && isCountingDown(player);
  const finished = player !== null && isFinished(player);

  // Which block intro we're on, or null outside intros. Drives the skip
  // reveal timer and resets the confirm when the intro changes.
  const introBlockIndex =
    player !== null && player.phase.kind === "blockIntro"
      ? player.phase.blockIndex
      : null;
  const [introSkipVisible, setIntroSkipVisible] = useState(false);
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  useEffect(() => {
    setIntroSkipVisible(false);
    setConfirmingSkip(false);
    if (introBlockIndex === null) return;
    const timer = setTimeout(
      () => setIntroSkipVisible(true),
      SKIP_REVEAL_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [introBlockIndex]);

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

      {phase.kind === "blockIntro" && !confirmingSkip && (
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
            {introSkipVisible ? (
              <FadeIn reduceMotion={reduceMotion}>
                <QuietButton
                  testID="player-skip"
                  label={strings.player.skipBlock}
                  onPress={() => setConfirmingSkip(true)}
                />
              </FadeIn>
            ) : (
              // Reserve the quiet control's space so Begin never jumps
              // when the exit appears.
              <View style={styles.skipPlaceholder} />
            )}
          </View>
        </>
      )}

      {phase.kind === "blockIntro" && confirmingSkip && (
        <>
          <View style={styles.center}>
            <AppText variant="title">
              {strings.player.skipConfirm.title(block.name)}
            </AppText>
            <AppText variant="bodySoft" style={styles.subline}>
              {strings.player.skipConfirm.body}
            </AppText>
          </View>
          <View style={styles.bottom}>
            <PrimaryButton
              testID="player-skip-keep"
              label={strings.player.skipConfirm.keepGoing}
              onPress={() => setConfirmingSkip(false)}
            />
            <QuietButton
              testID="player-skip-confirm"
              label={strings.player.skipConfirm.skipIt}
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
        <>
          <View style={styles.center}>
            <AppText variant="title">{strings.player.rest}</AppText>
            <AppText variant="numeral" testID="player-numeral" style={styles.restNumeral}>
              {phase.remainingSeconds}
            </AppText>
            <AppText variant="caption">{strings.player.restNote}</AppText>
          </View>
          <View style={styles.bottom}>
            <PrimaryButton
              testID="player-end-rest"
              label={strings.player.restDone}
              onPress={() => dispatchPlayer({ type: "advance" })}
            />
            <QuietButton
              testID="player-skip"
              label={strings.player.skipBlock}
              onPress={() => dispatchPlayer({ type: "skipBlock" })}
            />
          </View>
        </>
      )}

      {phase.kind === "feedback" && (
        <>
          <View style={styles.top}>
            <AppText variant="title">{strings.player.feedback.question}</AppText>
          </View>
          <View style={styles.bottom}>
            {/*
              Affective-to-outcome mapping — deliberate, NOT lost data.
              The engine contract stays exactly completed | struggled |
              skipped. Three answers exist so every answer feels fine to
              give: "Felt strong" and "Good" BOTH record "completed";
              "That was hard" records "struggled". The engine has no use
              for the strong/good distinction (its progression rules key
              off completed/struggled), so nothing is dropped here — do
              not add outcome kinds to preserve it.
            */}
            <RowButton
              testID="feedback-felt-strong"
              label={strings.player.feedback.options.feltStrong}
              onPress={() => dispatchPlayer({ type: "feedback", outcome: "completed" })}
            />
            <RowButton
              testID="feedback-good"
              label={strings.player.feedback.options.good}
              onPress={() => dispatchPlayer({ type: "feedback", outcome: "completed" })}
            />
            <RowButton
              testID="feedback-hard"
              label={strings.player.feedback.options.hard}
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
  skipPlaceholder: {
    minHeight: minTouchTarget,
  },
});
