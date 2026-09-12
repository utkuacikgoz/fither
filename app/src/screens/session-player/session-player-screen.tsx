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
import { MovementFigure } from "../../design/primitives/movement-figure";
import { Screen } from "../../design/primitives/screen";
import { Toast } from "../../design/primitives/toast";
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
import { FeedbackPhase, RestPhase, SideSwitchPhase, SkipControl } from "./player-phases";
import { useSettingsStore } from "../../state/settings-store";
import { announcementKey, countdownLine, phaseAnnouncement, workCue } from "./announcements";

// The session is sacred: movement name, complete setup, one live cue, one
// huge number, a thin progress line. Nothing else. No points mid-set.

/**
 * On a block intro she sees the movement first; the quiet exit appears
 * only after this long (2026-09-01 live-testing pass). UI pacing only —
 * no session rule hangs off this number. The work phase and the side
 * switch keep their exit visible from the start; the rest has none at all
 * (owner decision 2026-09-12).
 */
// The quiet exit must be visible for most of the intro, not flash up
// just before the hand-off starts the work (INTRO_SECONDS = 15): at
// eight seconds it appeared with two to spare.
export const SKIP_REVEAL_DELAY_MS = 3000;

/**
 * The quiet exit is a two-tap control (owner decision 2026-09-12: the
 * skip confirmation screen was rejected twice and deleted). After the
 * first tap it waits this long for the second, then returns to rest on
 * its own.
 *
 * Four seconds, chosen between two hard edges: far longer than a double
 * tap or a fumbled thumb (iOS treats ~0.3s as one gesture, so this is an
 * order of magnitude clear of an accidental second tap), and clearly
 * shorter than the intro's own 15-second hand-off, so an armed button can
 * never still be sitting there when the work starts by itself. It is a
 * convenience, never a clock she is racing — nothing counts down on
 * screen, and re-arming costs one tap.
 */
export const SKIP_ARM_TIMEOUT_MS = 4000;

interface SessionPlayerScreenProps {
  onFinished: () => void;
}

export function SessionPlayerScreen({ onFinished }: SessionPlayerScreenProps) {
  useKeepAwake();
  const player = useSessionStore((s) => s.player);
  const dispatchPlayer = useSessionStore((s) => s.dispatchPlayer);
  const reconcileTimer = useSessionStore((s) => s.reconcileTimer);
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
  // reveal timer.
  const introBlockIndex =
    player !== null && player.phase.kind === "blockIntro"
      ? player.phase.blockIndex
      : null;
  const [introSkipVisible, setIntroSkipVisible] = useState(false);
  // The quiet exit's two-tap state, and the one line she gets after a
  // skip lands. Both are presentation only: the machine records the skip
  // the moment the second tap dispatches, and nothing ever waits on the
  // toast.
  const [skipArmed, setSkipArmed] = useState(false);
  const [skipToast, setSkipToast] = useState<string | null>(null);

  const pressSkip = () => {
    if (!skipArmed) {
      setSkipArmed(true);
      return;
    }
    setSkipArmed(false);
    // A skipped block keeps no voice: the cue must not talk over the
    // next block's intro.
    stopVoice();
    dispatchPlayer({ type: "skipBlock" });
    // Which line she gets is the MACHINE's answer, not arithmetic here:
    // a skip that leaves the machine finished was the last block. The
    // view never counts blocks to decide it.
    const after = useSessionStore.getState().player;
    setSkipToast(
      after !== null && isFinished(after)
        ? strings.player.skippedLast
        : strings.player.skipped,
    );
  };

  // Leaving the session (finish, or the OS swiping it away) releases
  // whatever is speaking.
  useEffect(() => () => stopVoice(), []);

  useEffect(() => {
    setIntroSkipVisible(false);
    if (introBlockIndex === null) return;
    const timer = setTimeout(
      () => setIntroSkipVisible(true),
      SKIP_REVEAL_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [introBlockIndex]);

  // One tick per second whenever the MACHINE says the phase counts
  // (isCountingDown — intros and the side-switch hand-off included).
  // Nothing in the UI pauses it any more: the skip is a control in place,
  // so there is no screen sitting on top of the session holding its
  // clock.
  useEffect(() => {
    if (!counting) return;
    const interval = setInterval(() => dispatchPlayer({ type: "tick" }), 1000);
    return () => clearInterval(interval);
  }, [counting, dispatchPlayer]);

  useEffect(() => {
    // Native timers pause or drift while the app is backgrounded. The
    // persisted wall-clock deadline is authoritative when we return.
    reconcileTimer();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reconcileTimer();
    });
    return () => subscription.remove();
  }, [reconcileTimer]);

  useEffect(() => {
    if (finished) onFinished();
  }, [finished, onFinished]);

  // VoiceOver hears each phase TRANSITION exactly once (audit P0 #6):
  // the key ignores countdown seconds, so ticks and re-renders repeat a
  // key and stay silent. Arming the quiet exit is not a transition — the
  // key is unchanged, so nothing is re-announced; the skip itself lands
  // on the next block's fresh key.
  const phaseKey = player === null ? null : announcementKey(player);
  const announcedKey = useRef<string | null>(null);
  useEffect(() => {
    if (phaseKey === null) return;
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
  }, [phaseKey, voiceOn]);

  // An armed exit never carries over: the moment the machine moves to
  // another phase — her tap, a hand-off, a countdown running out — the
  // button is back at rest, so a tap meant for the set she just left can
  // never skip the next exercise or the next set. Keyed on the machine
  // POSITION, so a countdown tick does not disarm it.
  useEffect(() => {
    setSkipArmed(false);
  }, [phaseKey]);

  // ...and it disarms itself if the second tap never comes.
  useEffect(() => {
    if (!skipArmed) return;
    const timer = setTimeout(() => setSkipArmed(false), SKIP_ARM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [skipArmed]);

  // The last five seconds of a rest or a timed hold, counted down by the
  // voice (owner decision 2026-09-08): one line per second, the five a
  // warning. Spoken only — VoiceOver keeps its one announcement per
  // transition (audit P0 #6). Keyed on the line and the position, so a
  // re-render inside one second never repeats it.
  const countdown = player === null ? null : countdownLine(player);
  useEffect(() => {
    if (countdown === null || !voiceOn) return;
    void speakCue(countdown);
  }, [countdown, phaseKey, voiceOn]);

  // The skip's one line, over whatever phase she is on. It is a
  // confirmation, never a decision: it takes no touches, nothing waits on
  // it, and it leaves by itself well before the next exercise starts.
  const skipToastLayer = (
    <View
      style={styles.toastLayer}
      pointerEvents="none"
      testID="player-toast-layer"
    >
      <Toast
        testID="player-toast"
        message={skipToast}
        reduceMotion={reduceMotion}
        onHidden={() => setSkipToast(null)}
      />
    </View>
  );

  if (!player || player.phase.kind === "done") {
    // Skipping the LAST block lands here: her line stays up over the
    // closing player while the finish screen takes over.
    return <Screen>{skipToastLayer}</Screen>;
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

      {phase.kind === "blockIntro" && (
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
            {/* The hand-off, said plainly: she is getting into position,
                not being timed, and Begin below starts it sooner. Shown,
                never announced — VoiceOver speaks phase transitions, and
                a line that changes every second would talk over her. */}
            <AppText variant="caption" style={styles.subline} testID="player-intro-auto">
              {strings.player.autoStart(phase.remainingSeconds)}
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
                <SkipControl armed={skipArmed} onPress={pressSkip} />
              </FadeIn>
            ) : (
              // Reserve the quiet control's space so Begin never jumps
              // when the exit appears.
              <View style={styles.skipPlaceholder} />
            )}
          </View>
        </>
      )}

      {phase.kind === "work" && (
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
          </View>
          {/* The in-set correction sits in its own row above the
              buttons, never inside the centred column: the corrections
              run to two lines where the setup cues ran to one, and a
              132pt numeral plus a two-line cue overflowed a centred
              flex child and clipped the last line off the screen
              (owner, device pass 2026-09-09). Its own row also holds
              one position across the sets, so the line changing does
              not move the number she is reading. */}
          {currentCue !== null && (
            <View style={styles.cueRow}>
              <AppText variant="bodyLarge" style={styles.workCue}>
                {currentCue}
              </AppText>
            </View>
          )}
          <View style={styles.bottom}>
            {phase.remainingSeconds === null && (
              <PrimaryButton
                testID="player-set-done"
                label={strings.player.setDone}
                onPress={() => dispatchPlayer({ type: "advance" })}
              />
            )}
            <SkipControl armed={skipArmed} onPress={pressSkip} />
          </View>
        </>
      )}

      {phase.kind === "sideSwitch" && (
        <SideSwitchPhase
          block={block}
          remainingSeconds={phase.remainingSeconds}
          reduceMotion={reduceMotion}
          skipArmed={skipArmed}
          onAdvance={() => dispatchPlayer({ type: "advance" })}
          onSkip={pressSkip}
        />
      )}

      {phase.kind === "rest" && (
        <RestPhase
          remainingSeconds={phase.remainingSeconds}
          reduceMotion={reduceMotion}
        />
      )}

      {phase.kind === "feedback" && (
        <FeedbackPhase
          block={block}
          reduceMotion={reduceMotion}
          onOutcome={(outcome) => dispatchPlayer({ type: "feedback", outcome })}
        />
      )}

      {skipToastLayer}
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
    flexShrink: 1,
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
  cueRow: {
    // Never squeezed by the centred column above it, and never the
    // thing that gets clipped: the row keeps its content's height.
    flexShrink: 0,
    paddingBottom: spacing.md,
  },
  workCue: {
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
  toastLayer: {
    // The toast primitive lifts itself clear of a single quiet button;
    // the player's tallest bottom stack is a primary button ABOVE the
    // quiet exit (minTouchTarget + spacing.md, a gap, minTouchTarget, and
    // the row's own padding = 128pt), which is taller than that lift. So
    // the layer the toast lives in stops short of the controls instead of
    // the primitive being special-cased for this screen: the line never
    // covers the button she is reaching for. pointerEvents passes her
    // touches straight through the layer to the phase underneath.
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: spacing.xxl,
  },
});
