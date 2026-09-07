import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { SectionCaption } from "../../design/primitives/section-caption";
import { SettingsRow } from "../../design/primitives/settings-row";
import { useTheme } from "../../design/theme";
import { minTouchTarget, spacing } from "../../design/tokens";
import { feedbackAvailable } from "../../feedback/feedback";
import { eraseEverything } from "../../state/erase-all";
import { useIdentityStore } from "../../state/identity-store";
import { SettingsGroup } from "./settings-group";

// The Account group: for a guest, the door to Sign in with Apple (owner
// brief 2026-09-07: guest by default, so this is where sign-in lives);
// for a signed-in identity, sign out; and for both, erase everything on
// this phone — the account-deletion path App Review requires once Sign
// in with Apple exists (guideline 5.1.1(v)). Erase asks once, inline:
// the rows give way to the confirm panel (owner-approved erase-confirm
// mockup — danger hairline, the safe action filled, the destructive one
// quiet and in the danger colour), never a system dialog. Both exits
// land on "/" — the launch surface owns the gating order and, with no
// identity, makes her a guest again. Her training stays on the phone
// after a sign-out.
//
// No lead line above the sign-in row: a settings group is rows under a
// caption, with no slot for a body line (settings.account.signInLead
// stays unused until the page grows one).

interface AccountSectionProps {
  order: number;
  reduceMotion: boolean;
}

export function AccountSection({ order, reduceMotion }: AccountSectionProps) {
  const colors = useTheme();
  const identity = useIdentityStore((s) => s.identity);
  const signOut = useIdentityStore((s) => s.signOut);
  // Signed in means a provider identity; a guest (or, briefly, none at
  // all while a fresh guest lands) gets the door in, never the way out.
  const signedIn = identity !== null && identity.kind !== "guest";
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = strings.settings.account;

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
    <>
      <SectionCaption label={copy.title} />
      {confirming ? (
        <SettingsGroup
          order={order}
          reduceMotion={reduceMotion}
          variant="panel"
          outline="danger"
          testID="settings-erase-confirm"
        >
          <AppText variant="bodyLarge">{copy.eraseConfirmTitle}</AppText>
          <AppText variant="bodySoft">{copy.eraseConfirmBody}</AppText>
          <PrimaryButton
            testID="settings-erase-keep"
            label={copy.keepIt}
            onPress={() => setConfirming(false)}
          />
          {/* The destructive action, quiet and in the danger colour — a
              QuietButton's soft ink would make it a peer of "Keep it". */}
          <Pressable
            accessibilityRole="button"
            testID="settings-erase-confirm-action"
            onPress={() => {
              setConfirming(false);
              void handleErase();
            }}
            style={({ pressed }) => [styles.eraseAction, { opacity: pressed ? 0.6 : 1 }]}
          >
            <AppText variant="body" color={colors.danger}>
              {copy.eraseAction}
            </AppText>
          </Pressable>
        </SettingsGroup>
      ) : (
        <SettingsGroup order={order} reduceMotion={reduceMotion} testID="settings-account">
          {/* Her words to the owner (owner decision 2026-09-07). The row
              exists only where an endpoint will read them. */}
          {feedbackAvailable() && (
            <SettingsRow
              testID="settings-feedback"
              label={strings.feedback.row}
              chevron
              onPress={() => router.push("/settings/feedback")}
            />
          )}
          {signedIn ? (
            <SettingsRow
              testID="settings-sign-out"
              label={copy.signOut}
              onPress={() => void handleSignOut()}
            />
          ) : (
            <SettingsRow
              testID="settings-sign-in"
              label={copy.signIn}
              chevron
              onPress={() => router.push("/sign-in")}
            />
          )}
          <SettingsRow
            testID="settings-erase"
            label={copy.erase}
            tone="danger"
            divider={false}
            onPress={() => setConfirming(true)}
          />
        </SettingsGroup>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  eraseAction: {
    minHeight: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
});
