import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { BrandMark } from "../../design/primitives/brand-mark";
import { fontFamily, spacing } from "../../design/tokens";
import { useIdentityStore } from "../../state/identity-store";
import { useProfileStore } from "../../state/profile-store";
import { sinceLine } from "./settings-values";

// The profile header (owner-approved Settings mockup): the mark in the
// green, how she continues (guest with equal dignity, ADR-0011), and the
// day her record began. No name, no photo, nothing about her body — the
// account is only how she keeps her place. The since-line is omitted
// rather than faked when there is no history yet.

export function ProfileHeader() {
  const identity = useIdentityStore((s) => s.identity);
  const entries = useProfileStore((s) => s.history.entries);
  const copy = strings.settings.account;
  const status =
    identity?.kind === "apple"
      ? copy.status.apple
      : identity?.kind === "google"
        ? copy.status.google
        : copy.status.guest;
  const since = sinceLine(entries);

  return (
    <View style={styles.row} testID="settings-profile">
      <BrandMark size="small" />
      <View style={styles.text}>
        <AppText variant="body" style={styles.status} testID="settings-account-status">
          {status}
        </AppText>
        {since !== null && (
          <AppText variant="bodySoft" testID="settings-profile-since">
            {since}
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg + spacing.xs,
  },
  text: {
    flex: 1,
  },
  status: {
    // Weight by family name (ADR-0017): the status leads the header.
    fontFamily: fontFamily.semibold,
  },
});
