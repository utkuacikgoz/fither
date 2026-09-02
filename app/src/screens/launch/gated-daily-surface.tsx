import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { QuietButton } from "../../design/primitives/quiet-button";
import { spacing } from "../../design/tokens";
import { PaywallScreen } from "../paywall/paywall-screen";

// The day's surface in its gated state (ADR-0009 §3, audit P0 #7): an
// expired, unpurchased trial gates ONLY generating a new session —
// history, points, skills and settings stay hers. So expiry never swaps
// the shell for a bare paywall: the same frame as every other morning
// ("Today", and the quiet corner doors to Progress and Settings, in the
// same corner as always) with the paywall letter rendered where the
// prompt's questions would be. One decision per screen holds: on a
// gated day the one decision IS the subscription, so the letter sits
// inline instead of behind a "make today's session" button that could
// only lead to it anyway — the wrong path (answering four questions the
// engine won't act on) is prevented upstream by not rendering it.
export function GatedDailySurface() {
  return (
    <PaywallScreen
      headerSlot={
        <View>
          <View style={styles.header}>
            <AppText variant="caption" style={styles.dayLabel}>
              {strings.prompt.dayLabel}
            </AppText>
            {/* The identical doors (testIDs included) the daily prompt
                renders — pushed routes, so the way back is the platform's
                own and the gated day is still standing when she returns. */}
            <View style={styles.headerActions}>
              <QuietButton
                testID="open-progress"
                outlined
                label={strings.profile.title}
                onPress={() => router.push("/progress")}
              />
              <QuietButton
                testID="open-settings"
                outlined
                label={strings.settings.title}
                onPress={() => router.push("/settings")}
              />
            </View>
          </View>
          {/* The boundary, stated plainly (audit P0 #7): what stays hers
              vs. what the subscription buys — mapped to the doors above
              (her record) and the letter below (the new session). */}
          <AppText variant="bodySoft" style={styles.recordNote}>
            {strings.paywall.expired.recordNote}
          </AppText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayLabel: {
    marginTop: spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordNote: {
    marginTop: spacing.md,
  },
});
