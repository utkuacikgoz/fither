import { useEffect, useRef } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import type { HistoryEntry } from "@fither/engine";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { useTheme } from "../../design/theme";
import { minTouchTarget, motion, spacing, typeScale } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useTodayIso } from "../../lib/use-today";
import { sessionReceipt } from "../../session/receipt";
import { useIntentionStore } from "../../state/intention-store";
import { useProfileStore } from "../../state/profile-store";
import { useSessionStore, type FinishSummary } from "../../state/session-store";
import { weekView } from "../../state/week-view";
import { ReceiptTile } from "./receipt-tile";

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

/**
 * The entry the commit wrote: the last one dated the session's own day.
 * The engine appends in order, so a second session on one date is the
 * later entry. Null before the apply lands (or if it failed).
 */
function committedEntry(
  entries: readonly HistoryEntry[],
  date: string,
): HistoryEntry | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry && entry.date === date) return entry;
  }
  return null;
}

// The finish as a receipt (owner brief 2026-09-07, wave 2; mockup
// finish-receipt, approved): the close's headline and note, the faces
// of every block she attempted (a struggled one in the soft ink), the
// four-row receipt, the points when there are any, then Continue and a
// quiet Share. Everything drawn is read off the history entry the
// commit just wrote, through session/receipt.ts — the same record the
// engine was handed — never inferred from player state. The nothing-
// done close keeps its own shape: the headline, the note, one button.
export function FinishScreen({ onContinue }: FinishScreenProps) {
  const completeSession = useSessionStore((s) => s.completeSession);
  const finish = useSessionStore((s) => s.finish);
  const saveFailed = useSessionStore((s) => s.saveFailed);
  const saving = useSessionStore((s) => s.saving);
  const session = useSessionStore((s) => s.session);
  const reduceMotion = useReducedMotion();
  const colors = useTheme();
  const today = useTodayIso();

  // A session with zero attempted blocks gets the honest close — no
  // "complete", no "counts", no receipt, no share (ADR-0012 / audit P0 #5).
  const nothingDone = finish !== null && !finish.completedAnything;
  const settled = finish !== null;

  // The receipt: the entry the commit wrote, read once the close is
  // known. The session's own date is the date the engine stamped on it;
  // today is the fallback only for a summary with no session behind it.
  const historyEntries = useProfileStore((s) => s.history.entries);
  const target = useIntentionStore((s) => s.target);
  const sessionDate = session?.date ?? today;
  const entry = settled && !nothingDone ? committedEntry(historyEntries, sessionDate) : null;
  const receipt = entry ? sessionReceipt(entry) : null;
  const week = weekView(historyEntries, sessionDate, target);
  // Every attempted block's face, in session order, each in the tone of
  // its own outcome: ink for completed, soft for "Hard today".
  const figures = entry
    ? entry.blocks.filter((block) => block.outcome !== "skipped")
    : [];

  // A session of struggled blocks earns nothing: no "+0" row, the day
  // still counts (the headline, the figures and the receipt say so).
  const showPoints = finish !== null && !nothingDone && finish.pointsEarned > 0;

  // VoiceOver hears the close HERE, where the honest reason is known —
  // the player deliberately says nothing at done (a generic "Session
  // complete" could contradict "Today didn't fit"). Once per settle.
  const announcedRef = useRef(false);
  useEffect(() => {
    if (!finish || announcedRef.current) return;
    announcedRef.current = true;
    AccessibilityInfo.announceForAccessibility(closeCopy(finish).headline);
  }, [finish]);

  // share_eligible once, when a receipt with something on it settles:
  // the share is offered here, whether or not she takes it.
  const shareOfferedRef = useRef(false);
  useEffect(() => {
    if (!receipt || shareOfferedRef.current) return;
    shareOfferedRef.current = true;
    track("share_eligible", { source: "finish" });
  }, [receipt]);

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

  // Four beats once the close is known — the headline, the movements
  // she did, the receipt, then the points — in the unlock's own rhythm.
  // The saving and failed states are waiting states and get no
  // choreography; the buttons sit outside it and are tappable the moment
  // they render. The points rise in once and do not count up: a ticking
  // total is slot-machine energy, and points buy nothing here.
  const beat = (index: number) => ({
    reduceMotion,
    rise: settled ? motion.riseDistance : 0,
    delayMs: settled ? index * motion.staggerMs : 0,
  });

  return (
    <Screen>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* The headline is keyed on `settled` so it remounts and takes
            its beat instead of swapping text on an already-settled
            value. Nothing else is drawn until the close is known:
            figures under "Saving…" were not the effort, they were a
            guess (reviewer should-fix). */}
        <FadeIn key={settled ? "settled" : "waiting"} {...beat(0)}>
          <AppText variant="display" accessibilityRole="header">
            {headline}
          </AppText>
          <AppText variant="bodySoft" style={styles.note}>
            {note}
          </AppText>
        </FadeIn>
        {figures.length > 0 && (
          <FadeIn {...beat(1)}>
            <View style={styles.figures} testID="finish-figures">
              {figures.map((block, index) => (
                <MovementFigure
                  key={`${index}-${block.movementId}`}
                  movementId={block.movementId}
                  size={spacing.xxxl}
                  tone={block.outcome === "struggled" ? "soft" : "ink"}
                  testID={`finish-figure-${index}`}
                />
              ))}
            </View>
          </FadeIn>
        )}
        {receipt && (
          <View style={styles.receipt}>
            <ReceiptTile receipt={receipt} week={week} order={2} reduceMotion={reduceMotion} />
          </View>
        )}
        {finish && showPoints && (
          <FadeIn {...beat(3)}>
            <View style={styles.points}>
              <AppText
                variant="numeral"
                color={colors.accent}
                style={styles.pointsValue}
                testID="finish-points"
              >
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
      </ScrollView>
      <View style={styles.bottom}>
        {(finish || saveFailed) && !saving ? (
          <>
            <PrimaryButton
              testID={saveFailed ? "finish-retry" : "finish-continue"}
              label={saveFailed ? strings.errors.tryAgain : strings.finish.continueLabel}
              onPress={saveFailed ? completeSession : onContinue}
            />
            {receipt && (
              <QuietButton
                testID="finish-share"
                label={strings.finish.receipt.share}
                onPress={() => router.push("/share?source=finish")}
              />
            )}
          </>
        ) : (
          // Reserve the button's height while saving so the content does
          // not jump the moment the receipt rises in.
          <View style={styles.buttonPlaceholder} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.xl + spacing.sm,
    paddingBottom: spacing.lg,
  },
  note: {
    marginTop: spacing.sm,
  },
  figures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg - spacing.xs,
  },
  receipt: {
    marginTop: spacing.lg - spacing.xs,
  },
  points: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginTop: spacing.md + spacing.xs,
  },
  pointsValue: {
    // The numeral's face at the display size: the mockup's +20 sits
    // beside its unit, not as a total that owns the screen.
    fontSize: typeScale.display,
    lineHeight: typeScale.display * 1.1,
  },
  bottom: {
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  buttonPlaceholder: {
    minHeight: minTouchTarget + spacing.md,
  },
});
