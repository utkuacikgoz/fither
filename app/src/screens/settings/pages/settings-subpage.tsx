import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { AppText } from "../../../design/primitives/app-text";
import { Screen } from "../../../design/primitives/screen";
import { spacing } from "../../../design/tokens";

// The shell every Settings subpage wears (owner-approved settings-*
// mockups): the shared transparent back header above (the route adds
// it), the title, an optional lead line in the soft ink, then the one
// control. One decision per screen; the change saves the moment she
// taps, so there is no Save button and the chevron is the way out.
// `bottom` pins actions to the foot of the screen (the subscription
// page's buttons).

interface SettingsSubpageProps {
  title: string;
  lead?: string;
  children: ReactNode;
  bottom?: ReactNode;
  testID?: string;
}

export function SettingsSubpage({ title, lead, children, bottom, testID }: SettingsSubpageProps) {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        testID={testID}
      >
        <AppText
          variant="title"
          style={lead === undefined ? styles.titleAlone : styles.title}
          accessibilityRole="header"
        >
          {title}
        </AppText>
        {lead !== undefined && (
          <AppText variant="bodySoft" style={styles.lead}>
            {lead}
          </AppText>
        )}
        {children}
      </ScrollView>
      {bottom !== undefined && <View style={styles.bottom}>{bottom}</View>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  title: {
    // Clears the transparent navigation header (the back chevron lives
    // up there), the same clearance the daily prompt uses.
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  titleAlone: {
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  lead: {
    marginBottom: spacing.lg,
  },
  bottom: {
    paddingBottom: spacing.md,
    gap: spacing.sm + spacing.xs,
  },
});
