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
import { FadeIn } from "../../design/primitives/fade-in";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { ProgressLine } from "../../design/primitives/progress-line";
import { QuietButton } from "../../design/primitives/quiet-button";
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
import { speakCue, stopVoice } from "../../session/voice";
import { FeedbackPhase, RestPhase, SideSwitchPhase, SkipConfirmPhase } from "./player-phases";
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
  // The voice setting ALONE decides whether the cue is spoken. Quiet
  // movements and the coaching voice are separate (owner brief
  // 2026-09-07, wave 4): a quiet day changes which movements the engine
  // picks, never whether she hears her coach. No headphone detection,
  // nothing platform-specific — she chose the voice, she gets it.
  const voiceOn = useSettingsStore((s) => s.voice);

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
    // A skipped block keeps no voice: the cue must not talk over the
    // next block's intro.
    stopVoice();
    dispatchPlayer({ type: "skipBlock" });
    setConfirmingSkip(false);
  };

  // Leaving the session (finish, or the OS swiping it away) releases
  // whatever is speaking.
  useEffect(() => () => stopVoice(), []);

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
    // speaks at all is her Settings choice and nothing else; the phone's
    // silent switch wins on top of that, inside the port.
    const cue = player === null ? null : workCue(player);
    if (cue !== null && voiceOn) {
      void speakCue(cue);
    }
    // player is intentionally read, not depended on: ticks change it
    // without changing the position the key names.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmingSkip, phaseKey, voiceOn]);

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
        <SkipConfirmPhase
          blockName={block.name}
          onKeepGoing={() => {
            // The confirm paused the visible count; re-anchor the
            // wall-clock deadline so the seconds she saw are the seconds
            // she gets (audit polish — the stale deadline would eat the
            // pause on the next reconcile).
            rebaseCountdown();
            setConfirmingSkip(false);
          }}
          onSkip={confirmSkip}
        />
      )}

      {/* The one line of chrome inside a session (ADR-0017): which
          movement, and where she is in it — never a header, never a bar.
          At floor distance (the work phase, mockup player-work-floor) the
          row is set at body size, the name in ink and the counter soft;
          every other phase keeps the caption. */}
      <View style={styles.captionRow} testID="player-caption-row">
        <AppText variant={phase.kind === "work" ? "body" : "caption"}>
          {block.name}
        </AppText>
        <AppText variant={phase.kind === "work" ? "bodySoft" : "caption"}>
          {phase.kind === "work" || phase.kind === "rest"
            ? strings.player.setCounter(phase.setIndex + 1, block.sets)
            : strings.player.blockCounter(phase.blockIndex + 1, player.blocks.length)}
        </AppText>
      </View>

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
              animate
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
          <View style={styles.center}>
            <MovementFigure
              movementId={block.movementId}
              size="large"
              animate
              testID="player-figure-work"
            />
            {phase.side !== null && (
              <AppText variant="bodyLarge" testID="player-side">
                {strings.player.sides[phase.side]}
              </AppText>
            )}
            {/* Read from the floor a body-length away (owner-approved
                2026-09-07): the number is the largest thing in the
                product, the unit under it at body size, the cue set
                larger and heavier than the intro's reading. */}
            <AppText
              variant="countFloor"
              testID="player-numeral"
              accessibilityLabel={
                block.timingType === "seconds"
                  ? `${phase.remainingSeconds ?? block.amount} ${strings.player.holdLabel}`
                  : `${block.amount} ${strings.player.repsLabel}`
              }
            >
              {phase.remainingSeconds ?? block.amount}
            </AppText>
            <AppText variant="bodySoft" testID="player-unit">
              {block.timingType === "seconds"
                ? strings.player.holdLabel
                : strings.player.repsLabel}
            </AppText>
            {currentCue !== null && (
              <AppText variant="bodyLarge" style={styles.workCue}>
                {currentCue}
              </AppText>
            )}
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
        <SideSwitchPhase
          block={block}
          reduceMotion={reduceMotion}
          onAdvance={() => dispatchPlayer({ type: "advance" })}
          onSkip={() => setConfirmingSkip(true)}
        />
      )}

      {phase.kind === "rest" && !confirmingSkip && (
        <RestPhase
          remainingSeconds={phase.remainingSeconds}
          reduceMotion={reduceMotion}
          onAdvance={() => dispatchPlayer({ type: "advance" })}
          onSkip={() => setConfirmingSkip(true)}
        />
      )}

      {phase.kind === "feedback" && !confirmingSkip && (
        <FeedbackPhase
          block={block}
          reduceMotion={reduceMotion}
          onOutcome={(outcome) => dispatchPlayer({ type: "feedback", outcome })}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  captionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
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
  workCue: {
    marginTop: spacing.md,
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
  skipPlaceholder: {
    minHeight: minTouchTarget,
  },
});
