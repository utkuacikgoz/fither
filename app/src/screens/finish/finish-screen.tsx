import { useEffect, useRef } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { Screen } from "../../design/primitives/screen";
import { minTouchTarget, motion, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useSessionStore, type FinishSummary } from "../../state/session-store";

interface FinishScreenProps {
  onContinue: () => void;
}

/**
 * The four honest close states (ADR-0012 / audit wave 2), rendered from
 * the summary's close reason exactly as the store recorded it at the
 * moment the close happened — never inferred here from player state.
 * The `?? completed` fallback covers only legacy summaries that predate
 * the close field; completeSession always sets it.
 */
function closeCopy(finish: FinishSummary): { headline: string; note: string } {
  const close = finish.close ?? { reason: "completed" as const };
  switch (close.reason) {
    case "nothingDone":
      return {
        headline: strings.finish.nothingDone.headline,
        note: strings.finish.nothingDone.note,
      };
    case "endedEarly":
      return {
        headline: strings.finish.endedEarly.headline,
        note: strings.finish.endedEarly.note,
      };
    case "outOfTime":
      return {
        headline: strings.finish.outOfTime.headline(close.minutes),
        note: strings.finish.outOfTime.note,
      };
    case "completed":
      return { headline: strings.finish.headline, note: strings.finish.note };
  }
}

export function FinishScreen({ onContinue }: FinishScreenProps) {
  const completeSession = useSessionStore((s) => s.completeSession);
  const finish = useSessionStore((s) => s.finish);
  const saveFailed = useSessionStore((s) => s.saveFailed);
  const saving = useSessionStore((s) => s.saving);
  const player = useSessionStore((s) => s.player);
  const reduceMotion = useReducedMotion();

  // What she did, drawn: the figure of every block whose outcome the
  // player recorded as completed (ADR-0013 — the landing after the
  // effort shows the effort, not a sentence about it). Read straight off
  // the player's own outcomes, index-aligned to its blocks; the store
  // keeps the player until she continues, so this is the same record the
  // engine was handed. Nothing-done renders none, which is the honest
  // close showing nothing to show.
  const completedMovementIds =
    player === null
      ? []
      : player.blocks
          .filter((_, index) => player.outcomes[index] === "completed")
          .map((block) => block.movementId);

  // A session with zero completed blocks gets the honest close — no
  // "complete", no "counts", no points row (ADR-0012 / audit P0 #5).
  const nothingDone = finish !== null && !finish.completedAnything;

  // VoiceOver hears the close HERE, where the honest reason is known —
  // the player deliberately says nothing at done (a generic "Session
  // complete" could contradict "Today didn't fit"). Once per settle.
  const announcedRef = useRef(false);
  useEffect(() => {
    if (!finish || announcedRef.current) return;
    announcedRef.current = true;
    AccessibilityInfo.announceForAccessibility(closeCopy(finish).headline);
  }, [finish]);
  const { headline, note } = finish
    ? closeCopy(finish)
    : saveFailed
      ? {
          headline: strings.finish.failedHeadline,
          note: strings.errors.saveUnavailable,
        }
      : {
          headline: strings.finish.savingHeadline,
          note: strings.finish.savingNote,
        };

  // Apply the session through the engine boundary once, on arrival.
  useEffect(() => {
    completeSession();
  }, [completeSession]);

  // Three beats once the close is known — the movements she did, the
  // headline, then the points — in the unlock's own rhythm. The saving
  // and failed states are waiting states and get no choreography; the
  // Continue button sits outside it and is tappable the moment it
  // renders. The points rise in once and do not count up: a ticking
  // total is slot-machine energy, and points buy nothing here.
  const settled = finish !== null;
  const beat = (index: number) => ({
    reduceMotion,
    rise: settled ? motion.riseDistance : 0,
    delayMs: settled ? index * motion.staggerMs : 0,
  });

  return (
    <Screen>
      <View style={styles.center}>
        {/* Nothing is drawn until the close is known: figures under a
            "Saving…" headline were not the effort, they were a guess
            (reviewer should-fix). The headline is keyed on `settled` so
            it remounts and takes its beat instead of swapping text on
            an already-settled value. */}
        {settled && completedMovementIds.length > 0 && (
          <FadeIn {...beat(0)}>
            <View style={styles.figures} testID="finish-figures">
              {completedMovementIds.map((movementId, index) => (
                <MovementFigure
                  key={`${index}-${movementId}`}
                  movementId={movementId}
                  testID={`finish-figure-${index}`}
                />
              ))}
            </View>
          </FadeIn>
        )}
        <FadeIn key={settled ? "settled" : "waiting"} {...beat(1)}>
          <AppText
            variant="title"
            style={styles.headline}
            accessibilityRole="header"
          >
            {headline}
          </AppText>
          <AppText variant="bodySoft" style={styles.note}>
            {note}
          </AppText>
        </FadeIn>
        {finish && !nothingDone && (
          <FadeIn {...beat(2)}>
            <View style={styles.points}>
              <AppText variant="numeral" testID="finish-points">
                {`+${finish.pointsEarned}`}
              </AppText>
              {/* The unit agrees with the number (the long-flagged copy
                  nit, closed): one point reads "+1 point", never unitless
                  and never the false "+1 points". */}
              <AppText variant="caption">
                {strings.finish.pointsUnit(finish.pointsEarned)}
              </AppText>
            </View>
          </FadeIn>
        )}
      </View>
      <View style={styles.bottom}>
        {(finish || saveFailed) && !saving ? (
          <PrimaryButton
            testID={saveFailed ? "finish-retry" : "finish-continue"}
            label={saveFailed ? strings.errors.tryAgain : strings.finish.continueLabel}
            onPress={saveFailed ? completeSession : onContinue}
          />
        ) : (
          // Reserve the button's height while saving so the centred
          // content does not jump up the moment the points rise in.
          <View style={styles.buttonPlaceholder} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  figures: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  headline: {
    textAlign: "center",
  },
  note: {
    marginTop: spacing.sm,
    textAlign: "center",
  },
  points: {
    alignItems: "center",
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  bottom: {
    paddingBottom: spacing.md,
  },
  buttonPlaceholder: {
    minHeight: minTouchTarget + spacing.md,
  },
});
