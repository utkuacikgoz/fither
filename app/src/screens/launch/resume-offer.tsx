import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";

// One calm decision after an interrupted launch. Neither path is a wrong
// choice: "Keep going" resumes where she stopped, "Finish here" applies
// the blocks she already completed. Nothing is ever discarded, and the
// interruption itself goes unmentioned.

interface ResumeOfferProps {
  onContinue: () => void;
  onFinishHere: () => void;
}

export function ResumeOffer({ onContinue, onFinishHere }: ResumeOfferProps) {
  return (
    <Screen>
      <View style={styles.center}>
        <AppText variant="title">{strings.resume.headline}</AppText>
        <AppText variant="bodySoft" style={styles.note}>
          {strings.resume.line}
        </AppText>
      </View>
      <View style={styles.bottom}>
        <PrimaryButton
          testID="resume-continue"
          label={strings.resume.continueLabel}
          onPress={onContinue}
        />
        <QuietButton
          testID="resume-finish-here"
          label={strings.resume.finishLabel}
          onPress={onFinishHere}
        />
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
  note: {
    marginTop: spacing.sm,
  },
  bottom: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
});
