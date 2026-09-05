import { ScrollView, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { NoteField } from "../../design/primitives/note-field";
import { QuietButton } from "../../design/primitives/quiet-button";
import { spacing } from "../../design/tokens";

// The daily prompt's two outcomes that are not questions — generation
// failed, or the engine could not build around today's answers. Split
// out of daily-prompt-screen.tsx (brief rule: a screen over 400 lines
// is split); behaviour unchanged. The screen owns the decisions (retry,
// adjust, whether care leads); these render them.

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
  onAdjust: () => void;
}

export function PromptNoSession({
  care,
  careNoteText,
  onChangeCareNote,
  onAdjust,
}: PromptNoSessionProps) {
  return (
    <ScrollView
      style={styles.question}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator
    >
      {care && (
        <AppText
          variant="title"
          style={styles.careAcknowledgment}
          testID="care-acknowledgment"
        >
          {strings.care.acknowledgment}
        </AppText>
      )}
      <AppText variant="body" style={styles.title}>
        {strings.errors.noSession}
      </AppText>
      {care && (
        <View style={styles.careNote}>
          <NoteField
            testID="care-note"
            prompt={strings.care.notePrompt}
            privacyNote={strings.care.notePrivacy}
            value={careNoteText}
            onChangeText={onChangeCareNote}
          />
        </View>
      )}
      <QuietButton
        testID="prompt-adjust-answers"
        label={strings.preview.changeAnswers}
        onPress={onAdjust}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  question: {
    marginTop: spacing.xl,
  },
  title: {
    marginBottom: spacing.xl,
  },
  careAcknowledgment: {
    marginBottom: spacing.md,
  },
  careNote: {
    marginBottom: spacing.xl,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
});
