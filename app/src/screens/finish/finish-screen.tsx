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

  // Apply the session through the engine boundary once, on arrival.
  useEffect(() => {
    completeSession();
  }, [completeSession]);

  return (
    <Screen>
      <View style={styles.center}>
        <AppText variant="title">{strings.finish.headline}</AppText>
        <AppText variant="bodySoft" style={styles.note}>
          {strings.finish.note}
        </AppText>
        {finish && (
          <View style={styles.points}>
            <AppText variant="numeral" testID="finish-points">
              {`+${finish.pointsEarned}`}
            </AppText>
            <AppText variant="caption">{strings.finish.pointsLabel}</AppText>
          </View>
        )}
        {saveFailed && (
          <AppText variant="bodySoft" style={styles.note} testID="finish-save-failed">
            {strings.errors.saveUnavailable}
          </AppText>
        )}
      </View>
      <View style={styles.bottom}>
        <PrimaryButton
          testID={saveFailed ? "finish-retry" : "finish-continue"}
          label={saveFailed ? strings.errors.tryAgain : strings.finish.continueLabel}
          onPress={saveFailed ? completeSession : onContinue}
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
  points: {
    alignItems: "center",
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  bottom: {
    paddingBottom: spacing.md,
  },
});
