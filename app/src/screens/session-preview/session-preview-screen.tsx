import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { haptic } from "../../haptics/haptics";
import { AppText } from "../../design/primitives/app-text";
import { BrandMark } from "../../design/primitives/brand-mark";
import { FadeIn } from "../../design/primitives/fade-in";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { NoteField } from "../../design/primitives/note-field";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { hairline, spacing } from "../../design/tokens";
import { useTheme } from "../../design/theme";
import { needsCareMoment } from "../../lib/care-moment";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { loadLibrary } from "../../session/load-library";
import { sessionParagraph } from "../../session/session-facts";
import { careMomentDue, useCareNoteStore } from "../../state/care-note-store";
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
  const markCareMomentShown = useCareNoteStore(
    (state) => state.markCareMomentShown,
  );
  const [careNoteText, setCareNoteText] = useState("");
  // The care moment is its own beat (owner review 2026-09-07: never two
  // headlines on one screen): acknowledged or skipped once, then the
  // ordinary preview. "Once" spans the whole day and BOTH screens that
  // can open with it — the daily prompt's dead end may already have
  // shown it before the engine built this session (owner report
  // 2026-09-12), so the memory is the care-note store's, keyed by the
  // session's own date: the same local date this screen stamps her note
  // with. Read above the early return — hooks never move.
  const careSessionDate = session?.date ?? null;
  const careMomentStillDue = useCareNoteStore(
    (state) =>
      careSessionDate !== null && careMomentDue(state, careSessionDate),
  );

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
  const title = strings.preview.title(session.minutes);
  const paragraph = sessionParagraph(session, prompt, loadLibrary());

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

  if (care && careMomentStillDue) {
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
              // A note she wrote is kept, and the keeping is felt: the
              // page says nothing, the phone answers (ADR-0030).
              if (careNoteText.trim().length > 0) haptic("commit");
              // The note saves exactly as before, then the day
              // remembers the beat: neither screen asks again today.
              saveCareNote();
              markCareMomentShown(session.date);
            }}
          />
          <QuietButton
            testID="care-skip"
            label={strings.care.skip}
            onPress={() => {
              setCareNoteText("");
              markCareMomentShown(session.date);
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
        {/* One headline, one paragraph, then the plan (owner-approved
            mockup preview-b, 2026-09-09: the old screen was "too busy,
            less inspiring"). The three section captions and the bordered
            facts tile are gone; nothing here is labelled, because
            nothing here needs a label. The second line takes the accent:
            the minutes are the fact, the line under them is hers. Both
            halves come from one copy key so they cannot drift, and the
            pair reads to VoiceOver as one header, not two fragments. */}
        <FadeIn reduceMotion={reduceMotion}
          style={styles.top}
        >
          <View accessible accessibilityRole="header" accessibilityLabel={`${title.first} ${title.second}`}>
          <AppText variant="display" testID="preview-title-first">
            {title.first}
          </AppText>
          <AppText variant="display" color={colors.accent} testID="preview-title-second">
            {title.second}
          </AppText>
          </View>
        </FadeIn>
        <AppText variant="bodySoft" style={styles.paragraph} testID="preview-fit">
          {paragraph}
        </AppText>

        <View style={styles.plan}>
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
          reduceMotion={reduceMotion}
          label={strings.preview.start}
          onPress={start}
        />
        <QuietButton
          testID="preview-change-answers"
          label={strings.preview.changeAnswers}
          onPress={() => {
            track("preview_leave", { action: "changeAnswers" });
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
  paragraph: {
    // The reassurance, as prose under the headline: the tile and its
    // caption are gone, so the spacing is what separates it now.
    marginTop: spacing.md + spacing.xs,
    lineHeight: 24,
  },
  plan: {
    marginTop: spacing.xl,
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
