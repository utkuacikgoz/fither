import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { Card } from "../../design/primitives/card";
import { QuietButton } from "../../design/primitives/quiet-button";
import { spacing } from "../../design/tokens";

interface PreviousWeekCardProps {
  sessions: number;
  reduceMotion: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}

export function PreviousWeekCard({
  sessions,
  reduceMotion,
  onOpen,
  onDismiss,
}: PreviousWeekCardProps) {
  return (
    <View style={styles.section} testID="home-previous-week">
      <Card
        order={1}
        reduceMotion={reduceMotion}
        testID="home-previous-week-open"
        onPress={onOpen}
        accessibilityLabel={`${strings.recap.home.title}. ${strings.recap.home.line(sessions)} ${strings.recap.home.open}`}
      >
        <AppText variant="caption">{strings.recap.home.title}</AppText>
        <AppText variant="body" style={styles.line}>
          {strings.recap.home.line(sessions)}
        </AppText>
        <AppText variant="bodySoft" style={styles.open}>
          {strings.recap.home.open}
        </AppText>
      </Card>
      <View style={styles.dismiss}>
        <QuietButton
          testID="home-previous-week-dismiss"
          label={strings.recap.home.dismiss}
          onPress={onDismiss}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  line: {
    marginTop: spacing.sm,
  },
  open: {
    marginTop: spacing.md,
  },
  dismiss: {
    alignItems: "flex-start",
    marginTop: -spacing.md,
  },
});
