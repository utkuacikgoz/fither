import { useState } from "react";
import type { Adaptation } from "@fither/engine";
import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { NoteField } from "../../design/primitives/note-field";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
import { needsCareMoment } from "../../lib/care-moment";
import { useCareNoteStore } from "../../state/care-note-store";
import { useSessionStore } from "../../state/session-store";

function adaptationText(adaptation: Adaptation): string {
  switch (adaptation.kind) {
    case "soreness":
      return strings.preview.adaptations.soreness(
        adaptation.areas
          .map((area) => strings.prompt.soreness.areas[area].toLowerCase())
          .join(", "),
      );
    case "quiet":
      return strings.preview.adaptations.quiet;
    case "lowEnergy":
      return strings.preview.adaptations.lowEnergy;
    case "softLanding":
      return strings.preview.adaptations.softLanding;
    case "staleFocus":
      return strings.preview.adaptations.staleFocus;
    case "tasteBlock":
      return strings.preview.adaptations.tasteBlock;
  }
}

interface SessionPreviewScreenProps {
  onStart: () => void;
}

export function SessionPreviewScreen({ onStart }: SessionPreviewScreenProps) {
  const session = useSessionStore((state) => state.session);
  const prompt = useSessionStore((state) => state.prompt);
  const appendCareNote = useCareNoteStore((state) => state.append);
  const [careNoteText, setCareNoteText] = useState("");

  if (!session) return <Screen>{null}</Screen>;

  // The "everything hurts" moment when the engine could still build: the
  // preview leads with care, above the plan. The threshold reads only the
  // prompt the engine already saw — no session rules re-derived here.
  const care =
    prompt !== null && needsCareMoment(prompt.avoid.length, true);

  const explanations = session.adaptations.map(adaptationText);

  const start = () => {
    // Optional, local-only note: append-only store on this device, never
    // sent anywhere. Leaving it empty costs nothing.
    const note = careNoteText.trim();
    if (care && note.length > 0) {
      appendCareNote({ date: session.date, text: note });
    }
    onStart();
  };

  return (
    <Screen>
      {care && (
        <View style={styles.care}>
          <AppText
            variant="title"
            style={styles.careAcknowledgment}
            testID="care-acknowledgment"
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
        </View>
      )}

      <View style={styles.top}>
        <AppText variant="caption">{strings.preview.eyebrow}</AppText>
        <AppText variant="display" style={styles.headline}>
          {strings.preview.headline}
        </AppText>
        <AppText variant="bodySoft">
          {strings.preview.summary(session.minutes, session.blocks.length)}
        </AppText>
      </View>

      <View style={styles.fit}>
        {(explanations.length > 0
          ? explanations
          : [strings.preview.defaultFit]
        ).map((line, index) => (
          <AppText key={`${index}-${line}`} variant="body" style={styles.fitLine}>
            {line}
          </AppText>
        ))}
      </View>

      <View style={styles.bottom}>
        <PrimaryButton
          testID="preview-start"
          label={strings.preview.start}
          onPress={start}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  care: {
    marginTop: spacing.xl,
  },
  careAcknowledgment: {
    marginBottom: spacing.md,
  },
  top: {
    marginTop: spacing.xl,
  },
  headline: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  fit: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
  },
  fitLine: {
    marginRight: spacing.xl,
  },
  bottom: {
    paddingBottom: spacing.md,
  },
});
