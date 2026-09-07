import { useState } from "react";
import { StyleSheet } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { spacing } from "../../design/tokens";
import { useEntitlementStore } from "../../state/entitlement-store";

// Restore, shared by the Settings list's plain row and the subscription
// page's quiet button. Same handling as the paywall's restore (which
// stays there too — Apple wants restore near the purchase): "restored"
// needs no notice, the entitlement store simply holds the grant again;
// "empty" and "failed" each say their one calm line, right under the
// control that was tapped (mapping), never a dialog.

/** After a restore attempt: nothing to say, no purchase found, or failed. */
export type RestoreNoticeKind = "none" | "empty" | "failed";

export function useRestorePurchase(): {
  restore: () => void;
  notice: RestoreNoticeKind;
} {
  const restorePurchases = useEntitlementStore((s) => s.restorePurchases);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<RestoreNoticeKind>("none");

  const restore = () => {
    if (busy) return;
    setBusy(true);
    void restorePurchases().then((result) => {
      setNotice(result === "restored" ? "none" : result);
      setBusy(false);
    });
  };

  return { restore, notice };
}

interface RestoreNoticeProps {
  notice: RestoreNoticeKind;
}

/** The one line a restore attempt leaves behind, or nothing. */
export function RestoreNotice({ notice }: RestoreNoticeProps) {
  if (notice === "failed") {
    return (
      <AppText variant="bodySoft" style={styles.notice} testID="settings-restore-error">
        {strings.paywall.restoreError}
      </AppText>
    );
  }
  if (notice === "empty") {
    return (
      <AppText variant="bodySoft" style={styles.notice} testID="settings-restore-empty">
        {strings.paywall.restoreEmpty}
      </AppText>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  notice: {
    paddingVertical: spacing.md,
  },
});
