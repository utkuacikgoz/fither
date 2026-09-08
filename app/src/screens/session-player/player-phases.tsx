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
import { hairline, motion, radius, spacing } from "../../design/tokens";
import type { PlayerBlock } from "../../session/player-machine";

// The player's quiet phases — skip confirm, side switch, rest, feedback — split
// out of session-player-screen.tsx (brief rule: a screen over 400 lines
// is split). Behaviour unchanged: the screen owns the machine and the
// skip confirm; these render a phase and hand back her taps.

interface SkipConfirmPhaseProps {
  blockName: string;
  onKeepGoing: () => void;
  onSkip: () => void;
}

/**
 * One calm confirm as a card at the bottom (ADR-0017): the question, the
 * honest line, keeping going as the filled, safe default. The phase
 * behind it is not drawn — the card is the whole decision.
 */
export function SkipConfirmPhase({ blockName, onKeepGoing, onSkip }: SkipConfirmPhaseProps) {
  const colors = useTheme();
  return (
    <>
      <View style={styles.center} />
      <View
        style={[styles.confirmCard, { backgroundColor: colors.surface, borderColor: colors.line }]}
        testID="player-skip-card"
      >
        {/* Two groups, not one even stack (owner feedback 2026-09-08:
            title, line and buttons sat at one rhythm and read as
            crowded): the question with its line, a section gap, then
            the two answers. */}
        <View style={styles.confirmText}>
          <AppText variant="title" accessibilityRole="header">
            {strings.player.skipConfirm.title(blockName)}
          </AppText>
          <AppText variant="bodySoft">{strings.player.skipConfirm.body}</AppText>
        </View>
        <View style={styles.confirmActions}>
          <PrimaryButton
            testID="player-skip-keep"
            label={strings.player.skipConfirm.keepGoing}
            onPress={onKeepGoing}
          />
          <QuietButton
            testID="player-skip-confirm"
            label={strings.player.skipConfirm.skipIt}
            onPress={onSkip}
          />
        </View>
      </View>
    </>
  );
}

interface SideSwitchPhaseProps {
  block: PlayerBlock;
  reduceMotion: boolean;
  onAdvance: () => void;
  onSkip: () => void;
}

export function SideSwitchPhase({ block, reduceMotion, onAdvance, onSkip }: SideSwitchPhaseProps) {
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
      </FadeIn>
      <View style={styles.bottom}>
        <PrimaryButton
          testID="player-start-right"
          label={strings.player.sides.startRight}
          onPress={onAdvance}
        />
        <QuietButton testID="player-skip" label={strings.player.skipBlock} onPress={onSkip} />
      </View>
    </>
  );
}

interface RestPhaseProps {
  remainingSeconds: number;
  reduceMotion: boolean;
  onAdvance: () => void;
  onSkip: () => void;
}

export function RestPhase({
  remainingSeconds,
  reduceMotion,
  onAdvance,
  onSkip,
}: RestPhaseProps) {
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
        {/* Outlined, not filled: the rest never nags her out of it. */}
        <QuietButton
          outlined
          testID="player-end-rest"
          label={strings.player.restDone}
          onPress={onAdvance}
        />
        <QuietButton testID="player-skip" label={strings.player.skipBlock} onPress={onSkip} />
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
  confirmCard: {
    borderWidth: hairline,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  confirmText: {
    gap: spacing.sm,
  },
  confirmActions: {
    gap: spacing.xs,
  },
});
