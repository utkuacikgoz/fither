import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
import { useSessionStore } from "../../state/session-store";

interface FinishScreenProps {
  onContinue: () => void;
}

export function FinishScreen({ onContinue }: FinishScreenProps) {
  const completeSession = useSessionStore((s) => s.completeSession);
  const finish = useSessionStore((s) => s.finish);
  const saveFailed = useSessionStore((s) => s.saveFailed);
  const saving = useSessionStore((s) => s.saving);

  // A session with zero completed blocks gets the honest close — no
  // "complete", no "counts", no points row (ADR-0012 / audit P0 #5).
  const nothingDone = finish !== null && !finish.completedAnything;
  const headline = finish
    ? nothingDone
      ? strings.finish.nothingDone.headline
      : strings.finish.headline
    : saveFailed
      ? strings.finish.failedHeadline
      : strings.finish.savingHeadline;
  const note = finish
    ? nothingDone
      ? strings.finish.nothingDone.note
      : strings.finish.note
    : saveFailed
      ? strings.errors.saveUnavailable
      : strings.finish.savingNote;

  // Apply the session through the engine boundary once, on arrival.
  useEffect(() => {
    completeSession();
  }, [completeSession]);

  return (
    <Screen>
      <View style={styles.center}>
        <AppText variant="title">{headline}</AppText>
        <AppText variant="bodySoft" style={styles.note}>
          {note}
        </AppText>
        {finish && !nothingDone && (
          <View style={styles.points}>
            <AppText variant="numeral" testID="finish-points">
              {`+${finish.pointsEarned}`}
            </AppText>
            <AppText variant="caption">{strings.finish.pointsLabel}</AppText>
          </View>
        )}
      </View>
      <View style={styles.bottom}>
        {(finish || saveFailed) && !saving && (
          <PrimaryButton
            testID={saveFailed ? "finish-retry" : "finish-continue"}
            label={saveFailed ? strings.errors.tryAgain : strings.finish.continueLabel}
            onPress={saveFailed ? completeSession : onContinue}
          />
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
  note: {
    marginTop: spacing.sm,
  },
  points: {
    alignItems: "center",
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  bottom: {
    paddingBottom: spacing.md,
  },
});
