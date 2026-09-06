import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { spacing } from "../../design/tokens";
import { PaywallScreen } from "../paywall/paywall-screen";

// The day's surface in its gated state (ADR-0009 §3, audit P0 #7): an
// expired, unpurchased trial gates ONLY generating a new session —
// history, points, skills and settings stay hers. So expiry never swaps
// the shell for a bare paywall: the same frame as every other morning
// ("Today", the tab bar beneath) with the paywall letter rendered where
// the prompt's questions would be. One decision per screen holds: on a
// gated day the one decision IS the subscription, so the letter sits
// inline instead of behind a "make today's session" button that could
// only lead to it anyway. Progress and Settings are the bar's tabs
// (ADR-0017 removed the corner pills that duplicated them).
export function GatedDailySurface() {
  return (
    <PaywallScreen
      headerSlot={
        <View style={styles.header}>
          <AppText variant="caption">{strings.prompt.dayLabel}</AppText>
          {/* The boundary, stated plainly (audit P0 #7): what stays hers
              (one tab away) vs. what the subscription buys (the letter). */}
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
    marginTop: spacing.md,
  },
  recordNote: {
    marginTop: spacing.sm,
  },
});
