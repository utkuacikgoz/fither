import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { spacing } from "../../design/tokens";
import { PaywallScreen } from "../paywall/paywall-screen";

// The day's surface in its gated state (ADR-0009 §3, audit P0 #7): an
// expired, unpurchased trial gates ONLY generating a new session —
// history, points, skills and settings stay hers, one tab away. So the
// gated day keeps the day's own eyebrow and renders the selling screen
// where the questions would be (the paywall itself carries the expired
// headline and the record note). The corner doors that used to sit here
// are gone: Progress and Settings are tabs (ADR-0017).
export function GatedDailySurface() {
  return (
    <PaywallScreen
      inDay
      headerSlot={
        <View style={styles.header}>
          <AppText variant="caption">{strings.prompt.dayLabel}</AppText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.md,
  },
});
