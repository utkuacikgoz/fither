import type { Adaptation } from "@fither/engine";
import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
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

  if (!session) return <Screen>{null}</Screen>;

  const explanations = session.adaptations.map(adaptationText);

  return (
    <Screen>
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
          onPress={onStart}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
