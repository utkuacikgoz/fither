import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useKeepAwake } from "expo-keep-awake";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { AnswerRow } from "../../design/primitives/answer-row";
import { FadeIn } from "../../design/primitives/fade-in";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { ProgressLine } from "../../design/primitives/progress-line";
import { QuietButton } from "../../design/primitives/quiet-button";
import { RowButton } from "../../design/primitives/row-button";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { Screen } from "../../design/primitives/screen";
import { minTouchTarget, motion, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import {
  completedSets,
  isCountingDown,
  isFinished,
  progressFraction,
  totalSets,
} from "../../session/player-machine";
import { useSessionStore } from "../../state/session-store";
import { speakCue } from "../../session/voice";
import { useSettingsStore } from "../../state/settings-store";
import { announcementKey, phaseAnnouncement, workCue } from "./announcements";

// The session is sacred: movement name, complete setup, one live cue, one
// huge number, a thin progress line. Nothing else. No points mid-set.

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
  const reconcileTimer = useSessionStore((s) => s.reconcileTimer);
  const rebaseCountdown = useSessionStore((s) => s.rebaseCountdown);
  const reduceMotion = useReducedMotion();
  const voiceOn = useSettingsStore((s) => s.voice);
  // "Do you need to be quiet right now?" — a yes silences the voice for
  // the whole session, whatever Settings says. Read from the prompt the
  // engine was handed; absent (a resumed legacy snapshot) means not quiet.
  const quietDay = useSessionStore((s) => s.prompt?.quiet ?? false);

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

  const confirmSkip = () => {
    dispatchPlayer({ type: "skipBlock" });
    setConfirmingSkip(false);
  };

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
    if (!counting || confirmingSkip) return;
    const interval = setInterval(() => dispatchPlayer({ type: "tick" }), 1000);
    return () => clearInterval(interval);
  }, [confirmingSkip, counting, dispatchPlayer]);

  useEffect(() => {
    // Native timers pause or drift while the app is backgrounded. The
    // persisted wall-clock deadline is authoritative when we return —
    // except while the skip confirm holds the count: reconciling then
    // would eat the pause the confirm promised. The rebase on "Keep
    // going" re-anchors the deadline the moment the pause ends.
    if (confirmingSkip) return;
    reconcileTimer();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reconcileTimer();
    });
    return () => subscription.remove();
  }, [confirmingSkip, reconcileTimer]);

  useEffect(() => {
    if (finished) onFinished();
  }, [finished, onFinished]);

  // VoiceOver hears each phase TRANSITION exactly once (audit P0 #6):
  // the key ignores countdown seconds, so ticks and re-renders repeat a
  // key and stay silent. While the skip confirm is open nothing is
  // announced — its copy owns the screen; "Keep going" returns to the
  // same key, so nothing repeats, and a confirmed skip lands on the next
  // block's fresh key.
  const phaseKey = player === null ? null : announcementKey(player);
  const announcedKey = useRef<string | null>(null);
  useEffect(() => {
    if (phaseKey === null || confirmingSkip) return;
    if (announcedKey.current === phaseKey) return;
    announcedKey.current = phaseKey;
    const announcement =
      player === null ? null : phaseAnnouncement(player);
    if (announcement !== null) {
      AccessibilityInfo.announceForAccessibility(announcement);
    }
    // The spoken voice says the cue she is looking at, once per work set
    // (the same transition, the same key — never per tick). Whether it
    // speaks at all is decided HERE, where both facts are: her Settings
    // choice, and never on a day she answered "quiet" (the prompt the
    // engine already saw — no rule re-derived, just read). The silent
    // switch wins on top of that, inside the port.
    const cue = player === null ? null : workCue(player);
    if (cue !== null && voiceOn && !quietDay) {
      void speakCue(cue);
    }
    // player is intentionally read, not depended on: ticks change it
    // without changing the position the key names.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmingSkip, phaseKey, voiceOn, quietDay]);

  if (!player || player.phase.kind === "done") {
    return <Screen>{null}</Screen>;
  }

  const { phase } = player;
  const block = player.blocks[phase.blockIndex];
  if (!block) return <Screen>{null}</Screen>;
  const currentCue = workCue(player);

  return (
    <Screen>
      <ProgressLine
        testID="session-progress"
        fraction={progressFraction(player)}
        completed={completedSets(player)}
        total={totalSets(player)}
        reduceMotion={reduceMotion}
      />

      {confirmingSkip && (
        <>
          <View style={styles.center}>
            <AppText variant="title" accessibilityRole="header">
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
              onPress={() => {
                // The confirm paused the visible count; re-anchor the
                // wall-clock deadline so the seconds she saw are the
                // seconds she gets (audit polish — the stale deadline
                // would eat the pause on the next reconcile).
                rebaseCountdown();
                setConfirmingSkip(false);
              }}
            />
            <QuietButton
              testID="player-skip-confirm"
              label={strings.player.skipConfirm.skipIt}
              onPress={confirmSkip}
            />
          </View>
        </>
      )}

      {phase.kind === "blockIntro" && !confirmingSkip && (
        <>
          {/* The setup reading scrolls at large Dynamic Type sizes: the
              name + full cue sequence is the one unbounded text stack in
              the player, and Begin must stay pinned and reachable. When
              everything fits, flexGrow centers it exactly as before. */}
          <ScrollView
            style={styles.introScroll}
            contentContainerStyle={styles.introContent}
            showsVerticalScrollIndicator={false}
          >
            <MovementFigure
              movementId={block.movementId}
              size="hero"
              onWash
              testID="player-figure-intro"
            />
            <AppText variant="display" accessibilityRole="header">{block.name}</AppText>
            <AppText variant="bodySoft" style={styles.subline}>
              {strings.player.blockPlan(
                block.sets,
                block.amount,
                block.timingType === "seconds",
                block.unilateral,
              )}
            </AppText>
            {block.cues.length > 0 && (
              <View style={styles.cues} testID="player-cues">
                {block.cues.map((cue) => (
                  <AppText key={cue} variant="bodySoft" style={styles.cue}>
                    {cue}
                  </AppText>
                ))}
              </View>
            )}
          </ScrollView>
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

      {phase.kind === "work" && !confirmingSkip && (
        <>
          <View style={styles.top}>
            <View style={styles.workHeading}>
              <MovementFigure
                movementId={block.movementId}
                testID="player-figure-work"
              />
              <AppText variant="title" accessibilityRole="header" style={styles.workName}>
                {block.name}
              </AppText>
            </View>
            {currentCue !== null && (
              <AppText variant="bodySoft" style={styles.subline}>
                {currentCue}
              </AppText>
            )}
          </View>
          <View style={styles.center}>
            {phase.side !== null && (
              <AppText variant="bodyLarge" testID="player-side">
                {strings.player.sides[phase.side]}
              </AppText>
            )}
            <AppText
              variant="numeral"
              testID="player-numeral"
              accessibilityLabel={
                block.timingType === "seconds"
                  ? `${phase.remainingSeconds ?? block.amount} ${strings.player.holdLabel}`
                  : `${block.amount} ${strings.player.repsLabel}`
              }
            >
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
              onPress={() => setConfirmingSkip(true)}
            />
          </View>
        </>
      )}

      {phase.kind === "sideSwitch" && !confirmingSkip && (
        <>
          {/* The same movement, other side: its figure stays with her
              across the switch (every movement has a face — ADR-0013),
              and the phase enters as one quiet breath. */}
          <FadeIn
            reduceMotion={reduceMotion}
            rise={motion.riseDistance}
            style={styles.center}
          >
            <MovementFigure
              movementId={block.movementId}
              testID="player-figure-side"
            />
            <AppText variant="title" accessibilityRole="header">
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
              onPress={() => dispatchPlayer({ type: "advance" })}
            />
            <QuietButton
              testID="player-skip"
              label={strings.player.skipBlock}
              onPress={() => setConfirmingSkip(true)}
            />
          </View>
        </>
      )}

      {phase.kind === "rest" && !confirmingSkip && (
        <>
          {/* The calmest screen in the app — a deliberate exhale. It
              enters as one slow breath; the figure of the movement she
              is resting from sits small above the count, so the rest
              never reads as a blank between two screens. The number
              itself does not animate per tick: sixty tiny movements a
              minute is the opposite of calm. */}
          <FadeIn
            reduceMotion={reduceMotion}
            rise={motion.riseDistance}
            style={styles.center}
          >
            <MovementFigure
              movementId={block.movementId}
              testID="player-figure-rest"
            />
            <AppText variant="title">{strings.player.rest}</AppText>
            <AppText
              variant="numeral"
              testID="player-numeral"
              style={styles.restNumeral}
              accessibilityLabel={`${phase.remainingSeconds} ${strings.player.holdLabel}`}
            >
              {phase.remainingSeconds}
            </AppText>
            <AppText variant="caption">{strings.player.holdLabel}</AppText>
            <AppText variant="caption">{strings.player.restNote}</AppText>
          </FadeIn>
          <View style={styles.bottom}>
            <PrimaryButton
              testID="player-end-rest"
              label={strings.player.restDone}
              onPress={() => dispatchPlayer({ type: "advance" })}
            />
            <QuietButton
              testID="player-skip"
              label={strings.player.skipBlock}
              onPress={() => setConfirmingSkip(true)}
            />
          </View>
        </>
      )}

      {phase.kind === "feedback" && !confirmingSkip && (
        <>
          <View style={styles.top}>
            <AppText variant="title">{strings.player.feedback.question}</AppText>
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
                onPress={() => dispatchPlayer({ type: "feedback", outcome: "completed" })}
              />
            </AnswerRow>
            <AnswerRow index={1} reduceMotion={reduceMotion}>
              <RowButton
                testID="feedback-good"
                label={strings.player.feedback.options.good}
                onPress={() => dispatchPlayer({ type: "feedback", outcome: "completed" })}
              />
            </AnswerRow>
            <AnswerRow index={2} reduceMotion={reduceMotion}>
              <RowButton
                testID="feedback-hard"
                label={strings.player.feedback.options.hard}
                onPress={() => dispatchPlayer({ type: "feedback", outcome: "struggled" })}
              />
            </AnswerRow>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  workHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  workName: {
    flex: 1,
  },
  top: {
    marginTop: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  introScroll: {
    flex: 1,
  },
  introContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  bottom: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  subline: {
    marginTop: spacing.sm,
    textAlign: "center",
  },
  cues: {
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: "stretch",
  },
  cue: {
    textAlign: "center",
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
