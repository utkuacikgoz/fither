import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { useTheme } from "../../design/theme";
import { hairline, spacing } from "../../design/tokens";

interface PaywallActionsProps {
  reduceMotion: boolean;
  disclosure: string;
  label: string;
  busy: boolean;
  purchaseFailed: boolean;
  onPurchase: () => void;
  onLeave?: (() => void) | undefined;
}

/** The action and its price stay together while the offer details scroll. */
export function PaywallActions({ reduceMotion, disclosure, label, busy, purchaseFailed, onPurchase, onLeave }: PaywallActionsProps) {
  const colors = useTheme();
  return (
    <View style={[styles.footer, { borderTopColor: colors.line }]} testID="paywall-footer">
      {purchaseFailed && (
        <AppText variant="bodySoft" style={styles.error} testID="paywall-purchase-error">
          {strings.paywall.purchaseError}
        </AppText>
      )}
      <AppText variant="caption" style={styles.disclosure} testID="paywall-selected-price">
        {disclosure}
      </AppText>
      <PrimaryButton testID="paywall-purchase" reduceMotion={reduceMotion} busy={busy} label={label} onPress={onPurchase} />
      {onLeave && (
        <QuietButton testID="paywall-not-now" disabled={busy} reduceMotion={reduceMotion} label={strings.paywall.firstClose.notNow} onPress={onLeave} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { borderTopWidth: hairline, paddingTop: spacing.md },
  error: { textAlign: "center", marginBottom: spacing.sm },
  disclosure: { textAlign: "center", marginBottom: spacing.sm + spacing.xs },
});
