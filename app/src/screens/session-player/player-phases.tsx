import { StyleSheet, View } from "react-native";
import type { BlockOutcome } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AnswerRow } from "../../design/primitives/answer-row";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { RowButton } from "../../design/primitives/row-button";
import { useTheme } from "../../design/theme";
import { motion, spacing } from "../../design/tokens";
import type { PlayerBlock } from "../../session/player-machine";

// The player's quiet phases — side switch, rest, feedback — split out of
// session-player-screen.tsx (brief rule: a screen over 400 lines is
// split). The screen owns the machine; these render a phase and hand back
// her taps.

interface SkipControlProps {
  /** True after the first tap: the next tap skips. */
  armed: boolean;
  onPress: () => void;
}

/**
 * The quiet exit, in place (owner decision 2026-09-12, after the skip
 * confirmation screen was rejected twice and deleted): two taps, no
 * dialog, nothing else on the screen moves. The first tap arms it and
 * swaps the label; the second skips. One component so all four phases
 * that carry the exit — block intro, work, side switch, rest — read and
 * behave identically. The screen owns the armed state and its disarm,
 * because only the screen knows when the phase changed underneath it.
 */
export function SkipControl({ armed, onPress }: SkipControlProps) {
  return (
    <QuietButton
      testID="player-skip"
      armed={armed}
      // The label IS the warning she gets, so it changes with the state:
      // VoiceOver reads the same two words the eye does.
      label={armed ? strings.player.skipBlockArmed : strings.player.skipBlock}
      onPress={onPress}
    />
  );
}

interface SideSwitchPhaseProps {
  block: PlayerBlock;
  /** Seconds until the right side starts on its own (the hand-off). */
  remainingSeconds: number;
  reduceMotion: boolean;
  /** The quiet exit's two-tap state, owned by the screen. */
  skipArmed: boolean;
  onAdvance: () => void;
  onSkip: () => void;
}

export function SideSwitchPhase({
  block,
  remainingSeconds,
  reduceMotion,
  skipArmed,
  onAdvance,
  onSkip,
}: SideSwitchPhaseProps) {
  return (
    <>
      {/* The same movement, other side: its figure stays with her
          across the switch (every movement has a face — ADR-0013),
          and the phase enters as one quiet breath. */}
      <FadeIn reduceMotion={reduceMotion} rise={motion.riseDistance} style={styles.center}>
        <MovementFigure movementId={block.movementId} size="large" testID="player-figure-side" />
        <AppText variant="display" accessibilityRole="header">
          {strings.player.sides.switchTitle}
        </AppText>
        <AppText variant="bodySoft" style={styles.subline}>
          {strings.player.sides.switchBody}
        </AppText>
        {/* Starts itself; the button below starts it sooner. */}
        <AppText variant="caption" style={styles.subline} testID="player-side-auto">
          {strings.player.sides.autoStart(remainingSeconds)}
        </AppText>
      </FadeIn>
      <View style={styles.bottom}>
        <PrimaryButton
          testID="player-start-right"
          label={strings.player.sides.startRight}
          onPress={onAdvance}
        />
        <SkipControl armed={skipArmed} onPress={onSkip} />
      </View>
    </>
  );
}

interface RestPhaseProps {
  remainingSeconds: number;
  reduceMotion: boolean;
}

/**
 * The rest has nothing to press (owner decision 2026-09-12, the version
 * with neither button). It already counts down and starts the next set
 * itself, so "I'm ready" and the quiet exit were both offering what was
 * about to happen anyway. The skip lives on the block intro, the work
 * phase and the side switch; a rest is at most a minute, and the next
 * work phase brings it straight back.
 */
export function RestPhase({ remainingSeconds, reduceMotion }: RestPhaseProps) {
  const colors = useTheme();
  return (
    <>
      {/* The calmest screen in the app — a deliberate exhale. It enters
          as one slow breath; the figure of the movement she is resting
          from sits small above the count, so the rest never reads as a
          blank between two screens. The number itself does not animate
          per tick: sixty tiny movements a minute is the opposite of
          calm. */}
      <FadeIn reduceMotion={reduceMotion} rise={motion.riseDistance} style={styles.center}>
        <AppText variant="title" accessibilityRole="header">
          {strings.player.rest}
        </AppText>
        <AppText
          variant="count"
          color={colors.accent}
          testID="player-numeral"
          style={styles.restNumeral}
          accessibilityLabel={`${remainingSeconds} ${strings.player.holdLabel}`}
        >
          {remainingSeconds}
        </AppText>
        <AppText variant="bodySoft">{strings.player.restNote}</AppText>
      </FadeIn>
      <View style={styles.bottom}>
        {/* Where the two buttons were: one soft line, centred, stating
            what happens next. Not a control and never styled as one —
            nothing on the calmest screen in the app asks her to decide. */}
        <AppText variant="bodySoft" style={styles.restAutoStart} testID="player-rest-auto">
          {strings.player.restAutoStart}
        </AppText>
      </View>
    </>
  );
}

interface FeedbackPhaseProps {
  block: PlayerBlock;
  reduceMotion: boolean;
  onOutcome: (outcome: Exclude<BlockOutcome, "skipped">) => void;
}

export function FeedbackPhase({ block, reduceMotion, onOutcome }: FeedbackPhaseProps) {
  return (
    <>
      <View style={styles.feedbackTop}>
        <MovementFigure movementId={block.movementId} size="large" testID="player-figure-feedback" />
        <AppText variant="title" accessibilityRole="header" style={styles.feedbackQuestion}>
          {strings.player.feedback.question}
        </AppText>
      </View>
      <View style={styles.bottom}>
        {/*
          Affective-to-outcome mapping — deliberate, NOT lost data.
          The engine contract stays exactly completed | struggled |
          skipped. Three answers exist so every answer feels fine to
          give: "Strong" and "About right" BOTH record "completed";
          "Hard today" records "struggled". The engine has no use
          for the strong/good distinction (its progression rules key
          off completed/struggled), so nothing is dropped here — do
          not add outcome kinds to preserve it.
        */}
        <AnswerRow index={0} reduceMotion={reduceMotion}>
          <RowButton
            testID="feedback-felt-strong"
            label={strings.player.feedback.options.feltStrong}
            onPress={() => onOutcome("completed")}
          />
        </AnswerRow>
        <AnswerRow index={1} reduceMotion={reduceMotion}>
          <RowButton
            testID="feedback-good"
            label={strings.player.feedback.options.good}
            onPress={() => onOutcome("completed")}
          />
        </AnswerRow>
        <AnswerRow index={2} reduceMotion={reduceMotion}>
          <RowButton
            testID="feedback-hard"
            label={strings.player.feedback.options.hard}
            onPress={() => onOutcome("struggled")}
          />
        </AnswerRow>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  top: {
    marginTop: spacing.xl,
  },
  feedbackTop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  feedbackQuestion: {
    textAlign: "center",
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
    textAlign: "center",
  },
  restNumeral: {
    marginTop: spacing.sm,
  },
  restAutoStart: {
    textAlign: "center",
    // Breathing room where the two buttons stood, so the count above it
    // is not left sitting on the bottom edge. No touch-target height: it
    // is a line, not a control, and must not be sized like one.
    paddingVertical: spacing.md,
  },
});
