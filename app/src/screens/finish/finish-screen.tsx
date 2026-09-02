import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
import { useSessionStore, type FinishSummary } from "../../state/session-store";

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

export function FinishScreen({ onContinue }: FinishScreenProps) {
  const completeSession = useSessionStore((s) => s.completeSession);
  const finish = useSessionStore((s) => s.finish);
  const saveFailed = useSessionStore((s) => s.saveFailed);
  const saving = useSessionStore((s) => s.saving);

  // A session with zero completed blocks gets the honest close — no
  // "complete", no "counts", no points row (ADR-0012 / audit P0 #5).
  const nothingDone = finish !== null && !finish.completedAnything;
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
            {/* strings.finish.pointsLabel is the static plural unit; a
                parameterised singular does not exist yet (flagged for the
                copy-writer), so exactly one point renders unitless rather
                than as the false "+1 points". */}
            {finish.pointsEarned !== 1 && (
              <AppText variant="caption">{strings.finish.pointsLabel}</AppText>
            )}
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
