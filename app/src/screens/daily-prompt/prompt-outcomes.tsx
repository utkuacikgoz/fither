import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { BodyArea } from "@fither/engine";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { BrandMark } from "../../design/primitives/brand-mark";
import { NoteField } from "../../design/primitives/note-field";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { SettingsRow } from "../../design/primitives/settings-row";
import { Tile } from "../../design/primitives/tile";
import { useTheme } from "../../design/theme";
import { spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";

// The daily prompt's two outcomes that are not questions — generation
// failed, or the engine could not build around today's answers. Split
// out of daily-prompt-screen.tsx (brief rule: a screen over 400 lines
// is split). The screen owns the decisions (retry, adjust, which areas
// unblock — asked of the engine); these render them.

interface PromptErrorProps {
  onRetry: () => void;
}

export function PromptError({ onRetry }: PromptErrorProps) {
  return (
    <View style={styles.question}>
      <AppText variant="body" style={styles.title}>
        {strings.errors.sessionUnavailable}
      </AppText>
      {/* Audit S4b: "Try again" truthfully names a retry — the same
          answers go back through generation; nothing resets. */}
      <QuietButton
        testID="prompt-try-again"
        label={strings.errors.tryAgain}
        onPress={onRetry}
      />
    </View>
  );
}

interface PromptNoSessionProps {
  /** Lead with care: body areas were part of what the engine refused. */
  care: boolean;
  careNoteText: string;
  onChangeCareNote: (text: string) => void;
  /** How many areas today's session had to work around, in total. */
  areaCount: number;
  /** Areas which, set aside alone for today, let the engine build. */
  unblocking: readonly BodyArea[];
  onSetAside: (area: BodyArea) => void;
  onAdjust: () => void;
}

/**
 * The dead end that recommends the way out (owner decision 2026-09-07):
 * the engine names which single area, set aside for today, makes a
 * session, and each one is a tappable row that builds it. Care leads as
 * its own beat when sore areas caused this — one headline per screen.
 */
export function PromptNoSession({
  care,
  careNoteText,
  onChangeCareNote,
  areaCount,
  unblocking,
  onSetAside,
  onAdjust,
}: PromptNoSessionProps) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const [careDone, setCareDone] = useState(false);

  if (care && !careDone) {
    return (
      <>
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
          onChangeText={onChangeCareNote}
        />
        {/* The buttons stay under the field (above the keyboard while
            she types), a section apart from it and a beat apart from
            each other — owner feedback 2026-09-08: the filled button
            sat flush against the note. */}
        <View style={styles.careActions}>
          <PrimaryButton
            testID="care-continue"
            label={strings.care.continueNoSession}
            onPress={() => {
              // care_note: whether a note stays on the phone — never
              // the note. Continue with an empty field kept nothing.
              track("care_note", { saved: careNoteText.trim().length > 0 });
              setCareDone(true);
            }}
          />
          <QuietButton
            testID="care-skip"
            label={strings.care.skip}
            onPress={() => {
              track("care_note", { saved: false });
              onChangeCareNote("");
              setCareDone(true);
            }}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.question}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <View style={styles.careMark}>
          <BrandMark size="small" tint={colors.accentSoft} testID="no-session-mark" />
        </View>
        <AppText
          variant="title"
          accessibilityRole="header"
          testID="no-session-headline"
        >
          {strings.prompt.noSession.headline(areaCount)}
        </AppText>
        <AppText variant="bodySoft" style={styles.instruction}>
          {unblocking.length > 0
            ? strings.prompt.noSession.instruction
            : strings.prompt.noSession.none}
        </AppText>
        {/* The ways out as one grouped tile of choices, not loose rows
            under a rule (owner feedback 2026-09-08: show, do not tell):
            the tile is the offer, each row one area she can work today. */}
        {unblocking.length > 0 && (
          <Tile
            inset="list"
            reduceMotion={reduceMotion}
            style={styles.rows}
            testID="no-session-rows"
          >
            {unblocking.map((area, index) => (
              <SettingsRow
                key={area}
                testID={`no-session-set-aside-${area}`}
                label={strings.prompt.noSession.setAside(
                  strings.prompt.soreness.areas[area].toLowerCase(),
                )}
                chevron
                divider={index < unblocking.length - 1}
                onPress={() => onSetAside(area)}
              />
            ))}
          </Tile>
        )}
        <AppText variant="caption" style={styles.settingsNote}>
          {strings.prompt.noSession.settingsNote}
        </AppText>
      </ScrollView>
      {/* Quiet, not outlined: the rows above are the decision; this is
          the other door, and a pill at the bottom competed with them. */}
      <View style={styles.bottom}>
        <QuietButton
          testID="prompt-adjust-answers"
          label={strings.preview.changeAnswers}
          onPress={onAdjust}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  question: {
    marginTop: spacing.xl,
  },
  title: {
    marginBottom: spacing.xl,
  },
  careMark: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    alignItems: "flex-start",
  },
  careAcknowledgment: {
    marginBottom: spacing.lg,
  },
  instruction: {
    marginTop: spacing.md,
  },
  rows: {
    marginTop: spacing.lg,
  },
  settingsNote: {
    marginTop: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  careActions: {
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  bottom: {
    paddingBottom: spacing.md,
  },
});
