import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { BrandMark } from "../../design/primitives/brand-mark";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { NoteField } from "../../design/primitives/note-field";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { SectionCaption } from "../../design/primitives/section-caption";
import { Tile } from "../../design/primitives/tile";
import { hairline, spacing } from "../../design/tokens";
import { useTheme } from "../../design/theme";
import { needsCareMoment } from "../../lib/care-moment";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { loadLibrary } from "../../session/load-library";
import { sessionFacts } from "../../session/session-facts";
import { useCareNoteStore } from "../../state/care-note-store";
import { useSessionStore } from "../../state/session-store";

interface SessionPreviewScreenProps {
  onStart: () => void;
  onChangeAnswers: () => void;
}

export function SessionPreviewScreen({
  onStart,
  onChangeAnswers,
}: SessionPreviewScreenProps) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const session = useSessionStore((state) => state.session);
  const player = useSessionStore((state) => state.player);
  const prompt = useSessionStore((state) => state.prompt);
  const prepareSessionEdit = useSessionStore((state) => state.prepareSessionEdit);
  const appendCareNote = useCareNoteStore((state) => state.append);
  const [careNoteText, setCareNoteText] = useState("");
  // The care moment is its own beat (owner review 2026-09-07: never two
  // headlines on one screen): acknowledged or skipped once, then the
  // ordinary preview.
  const [careDone, setCareDone] = useState(false);

  // session_preview (ADR-0024): a built session was on screen, once per
  // session, whatever she does next. Above the early return: hooks
  // never move.
  const previewSeed = session?.seed ?? null;
  const previewMinutes = session?.minutes ?? null;
  const previewBlocks = session?.blocks.length ?? 0;
  useEffect(() => {
    if (previewSeed === null || previewMinutes === null) return;
    track("session_preview", { minutes: previewMinutes, blocks: previewBlocks });
  }, [previewSeed, previewMinutes, previewBlocks]);

  if (!session || !player) return <Screen>{null}</Screen>;

  // The "everything hurts" moment when the engine could still build: the
  // preview leads with care, above the plan. The threshold reads only the
  // prompt the engine already saw — no session rules re-derived here.
  const care =
    prompt !== null && needsCareMoment(prompt.avoid.length, true);

  // Why it fits (owner brief 2026-09-07): a short list of facts the
  // engine emitted, mapped to words in session-facts. Nothing here
  // decides anything; the library is read only to state what the
  // session's movements are.
  const facts = sessionFacts(session, prompt, loadLibrary());

  // Optional, local-only note: append-only store on this device, never
  // sent anywhere. Leaving it empty costs nothing. Saved on EVERY way off
  // this screen (audit polish) — words she wrote on a heavy day are never
  // dropped because she went back to adjust an answer.
  const saveCareNote = () => {
    const note = careNoteText.trim();
    if (care && note.length > 0) {
      appendCareNote({ date: session.date, text: note });
      setCareNoteText("");
    }
  };

  const start = () => {
    saveCareNote();
    onStart();
  };

  if (care && !careDone) {
    return (
      <Screen>
        <View style={styles.careMark}>
          <BrandMark size="small" tint={colors.accentSoft} testID="care-mark" />
        </View>
        <AppText
          variant="title"
          style={styles.careAcknowledgment}
          testID="care-acknowledgment"
          accessibilityRole="header"
        >
          {strings.care.acknowledgment}
        </AppText>
        <NoteField
          testID="care-note"
          prompt={strings.care.notePrompt}
          privacyNote={strings.care.notePrivacy}
          value={careNoteText}
          onChangeText={setCareNoteText}
        />
        <View style={styles.bottom}>
          <PrimaryButton
            testID="care-continue"
            label={strings.care.continue}
            onPress={() => {
              saveCareNote();
              setCareDone(true);
            }}
          />
          <QuietButton
            testID="care-skip"
            label={strings.care.skip}
            onPress={() => {
              setCareNoteText("");
              setCareDone(true);
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        // The owner could not tell the list scrolled (Norman: signifiers
        // — a hidden scrollbar removes the only cue that content
        // continues). Shown here; the session player stays clean.
        showsVerticalScrollIndicator
      >
        <View style={styles.top}>
          <AppText variant="caption">{strings.preview.eyebrow}</AppText>
          <AppText variant="display" style={styles.headline} accessibilityRole="header">
            {strings.preview.headline}
          </AppText>
        </View>

        {/* The facts list, plain body lines on the same surface tile as
            the plan, its caption outside (design ledger, round 5). The
            count lives here, so the headline carries no summary line. */}
        <View style={styles.facts}>
          <SectionCaption label={strings.preview.factsTitle} />
          <Tile reduceMotion={reduceMotion} testID="preview-fit">
            {facts.map((fact, index) => (
              <AppText
                key={`${index}-${fact}`}
                variant="body"
                style={styles.factLine}
                testID={`preview-fact-${index}`}
              >
                {fact}
              </AppText>
            ))}
          </Tile>
        </View>

        <View style={styles.plan}>
          <AppText variant="caption" style={styles.planTitle}>
            {strings.preview.planTitle}
          </AppText>
          {player.blocks.map((block, index) => (
            <View
              key={`${index}-${block.movementId}`}
              testID={`preview-block-${index}`}
              style={[styles.blockRow, { borderBottomColor: colors.line }]}
            >
              {/* Every movement has a face (ADR-0013) — she sees the
                  shape of the work, not just its name. */}
              <MovementFigure movementId={block.movementId} />
              <View style={styles.blockText}>
                <AppText variant="bodyLarge">{block.name}</AppText>
                <AppText variant="caption">
                  {strings.player.blockPlan(
                    block.sets,
                    block.amount,
                    block.timingType === "seconds",
                    block.unilateral,
                  )}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <PrimaryButton
          testID="preview-start"
          label={strings.preview.start}
          onPress={start}
        />
        <QuietButton
          testID="preview-change-answers"
          label={strings.preview.changeAnswers}
          onPress={() => {
            saveCareNote();
            prepareSessionEdit();
            onChangeAnswers();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  careMark: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  careAcknowledgment: {
    marginBottom: spacing.md,
  },
  top: {
    marginTop: spacing.xl,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    // Generous tail so the last block ends cleanly above the footer
    // instead of being sliced mid-word at the scroll edge (owner report).
    paddingBottom: spacing.xxl,
  },
  headline: {
    marginTop: spacing.sm,
  },
  facts: {
    marginTop: spacing.xl,
  },
  factLine: {
    paddingVertical: spacing.xs,
  },
  plan: {
    marginTop: spacing.xl,
  },
  planTitle: {
    marginBottom: spacing.sm,
  },
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: hairline,
  },
  blockText: {
    flex: 1,
    gap: spacing.xs,
  },
  bottom: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
});
