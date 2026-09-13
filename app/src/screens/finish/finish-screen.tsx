import { useEffect, useRef } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  nextMilestone,
  tiersToMilestone,
  type HistoryEntry,
} from "@fither/engine";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { Card } from "../../design/primitives/card";
import { FadeIn } from "../../design/primitives/fade-in";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { minTouchTarget, motion, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useTodayIso } from "../../lib/use-today";
import { sessionReceipt } from "../../session/receipt";
import { loadLibrary } from "../../session/load-library";
import { skillFigureId, skillLabel } from "../../session/skill-name";
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
  const today = useTodayIso();

  // A session with zero attempted blocks gets the honest close — no
  // "complete", no "counts", no receipt, no share (ADR-0012 / audit P0 #5).
  const nothingDone = finish !== null && !finish.completedAnything;
  const settled = finish !== null;

  // The receipt: the entry the commit wrote, read once the close is
  // known. The session's own date is the date the engine stamped on it;
  // today is the fallback only for a summary with no session behind it.
  const historyEntries = useProfileStore((s) => s.history.entries);
  const profile = useProfileStore((s) => s.profile);
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
  const library = loadLibrary();
  // A skill earned in this session gets its own unlock screen next. Do
  // not point past it here; the starting-path card is for a first close
  // whose next capability has not already arrived.
  const firstUpcoming =
    finish?.first && finish.unlockedSkills.length === 0
      ? nextMilestone(profile)
      : null;
  const firstTiersAway = firstUpcoming
    ? tiersToMilestone(profile, firstUpcoming)
    : 0;

  // A session of struggled blocks earns nothing: no "+0" row on the
  // receipt, the day still counts (the headline, the figures and the
  // receipt say so).
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

  // Once the close is known: the headline, the one-time starting path
  // when due, the movements she did, then the receipt with the points as
  // its last line. The saving and failed states are waiting states
  // and get no choreography; the buttons sit outside it and are tappable
  // the moment they render. The points rise in with the receipt and do
  // not count up: a ticking total is slot-machine energy, and points buy
  // nothing here.
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
        {firstUpcoming && (
          <View style={styles.firstPath}>
            <Card
              reduceMotion={reduceMotion}
              order={1}
              testID="finish-first-path"
            >
              <View style={styles.firstPathRow}>
                <MovementFigure
                  movementId={skillFigureId(
                    library,
                    firstUpcoming.pattern,
                    firstUpcoming.tier,
                  )}
                  size={spacing.xxxl}
                  tone="accent"
                />
                <View style={styles.firstPathCopy}>
                  <AppText variant="bodyLarge">
                    {strings.finish.first.title}
                  </AppText>
                  <AppText variant="bodySoft" style={styles.firstPathLine}>
                    {strings.finish.first.next(
                      skillLabel(
                        library,
                        firstUpcoming.pattern,
                        firstUpcoming.tier,
                      ),
                      firstTiersAway,
                    )}
                  </AppText>
                </View>
              </View>
            </Card>
          </View>
        )}
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
            <ReceiptTile
              receipt={receipt}
              week={week}
              points={showPoints && finish ? finish.pointsEarned : 0}
              order={2}
              reduceMotion={reduceMotion}
            />
          </View>
        )}
      </ScrollView>
      <View style={styles.bottom}>
        {(finish || saveFailed) && !saving ? (
          <>
            <PrimaryButton
              reduceMotion={reduceMotion}
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
  firstPath: {
    marginTop: spacing.lg,
  },
  firstPathRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  firstPathCopy: {
    flex: 1,
  },
  firstPathLine: {
    marginTop: spacing.xs,
  },
  receipt: {
    marginTop: spacing.lg - spacing.xs,
  },
  bottom: {
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  buttonPlaceholder: {
    minHeight: minTouchTarget + spacing.md,
  },
});
