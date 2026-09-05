import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { Card } from "../../design/primitives/card";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { spacing } from "../../design/tokens";
import { eraseEverything } from "../../state/erase-all";
import { useIdentityStore } from "../../state/identity-store";

// The account card: how she is continuing, sign out, and erase
// everything on this phone — the account-deletion path App Review
// requires once Sign in with Apple exists (guideline 5.1.1(v)). Same
// shape as the care journal's delete: the confirm renders inside the
// card, the safe action is the primary one, and nothing about it is a
// system dialog. Both exits land on "/" — the launch surface owns the
// gating order and, with no identity, shows the sign-in choice.

interface AccountCardProps {
  order: number;
  reduceMotion: boolean;
}

export function AccountCard({ order, reduceMotion }: AccountCardProps) {
  const identity = useIdentityStore((s) => s.identity);
  const signOut = useIdentityStore((s) => s.signOut);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = strings.settings.account;
  const status =
    identity?.kind === "apple"
      ? copy.status.apple
      : identity?.kind === "google"
        ? copy.status.google
        : copy.status.guest;

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
    router.replace("/");
  };

  const handleErase = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await eraseEverything();
    } finally {
      setBusy(false);
    }
    router.replace("/");
  };

  return (
    <Card order={order} reduceMotion={reduceMotion} testID="settings-account">
      <AppText variant="caption" style={styles.sectionHeading}>
        {copy.title}
      </AppText>
      <AppText variant="bodySoft" style={styles.status} testID="settings-account-status">
        {status}
      </AppText>

      {confirming ? (
        <View style={styles.confirm} testID="settings-erase-confirm">
          <AppText variant="body">{copy.eraseConfirmTitle}</AppText>
          <AppText variant="bodySoft">{copy.eraseConfirmBody}</AppText>
          <PrimaryButton
            testID="settings-erase-keep"
            label={copy.keepIt}
            onPress={() => setConfirming(false)}
          />
          <QuietButton
            testID="settings-erase-confirm-action"
            label={copy.eraseAction}
            onPress={() => {
              setConfirming(false);
              void handleErase();
            }}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <QuietButton
            testID="settings-sign-out"
            label={copy.signOut}
            outlined
            onPress={() => void handleSignOut()}
          />
          <AppText variant="caption">{copy.signOutNote}</AppText>
          <QuietButton
            testID="settings-erase"
            label={copy.erase}
            onPress={() => setConfirming(true)}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionHeading: {
    marginBottom: spacing.sm,
  },
  status: {
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  confirm: {
    gap: spacing.sm,
  },
});
