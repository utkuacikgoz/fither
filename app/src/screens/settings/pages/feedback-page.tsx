import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { strings } from "../../../copy/strings";
import { AppText } from "../../../design/primitives/app-text";
import { BrandMark } from "../../../design/primitives/brand-mark";
import { PrimaryButton } from "../../../design/primitives/primary-button";
import { Screen } from "../../../design/primitives/screen";
import { useTheme } from "../../../design/theme";
import { fontFamily, hairline, radius, spacing, typeScale } from "../../../design/tokens";
import { useFeedbackStore, type SubmitResult } from "../../../state/feedback-store";
import { SettingsSubpage } from "./settings-subpage";

// Send feedback (mockups settings-feedback, settings-feedback-sent;
// owner-approved 2026-09-07 "show do not tell"): the title, the field,
// the optional email, Send. No lead, no privacy caption. Sending never
// makes her wait on the network: the store answers sent or queued, and
// the sent state is the same calm page either way, with the queued line
// when it applies.

export function FeedbackPage() {
  const colors = useTheme();
  const submit = useFeedbackStore((s) => s.submit);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const handleSend = async () => {
    if (busy || message.trim().length === 0) return;
    setBusy(true);
    try {
      setResult(await submit({ message, email }));
    } finally {
      setBusy(false);
    }
  };

  if (result !== null) {
    return (
      <Screen>
        <View style={styles.center} testID="feedback-sent">
          <View style={styles.mark}>
            <BrandMark size="small" tint={colors.accentSoft} />
          </View>
          <AppText variant="title" accessibilityRole="header">
            {strings.feedback.sent}
          </AppText>
          <AppText variant="bodySoft" style={styles.note}>
            {result === "queued" ? strings.feedback.queued : strings.feedback.sentNote}
          </AppText>
        </View>
        <View style={styles.bottom}>
          <PrimaryButton
            testID="feedback-done"
            label={strings.feedback.done}
            onPress={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  const field = {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    color: colors.ink,
  };

  return (
    <SettingsSubpage
      title={strings.feedback.title}
      testID="settings-feedback"
      bottom={
        <PrimaryButton
          testID="feedback-send"
          label={strings.feedback.send}
          onPress={() => void handleSend()}
        />
      }
    >
      <TextInput
        testID="feedback-message"
        style={[styles.message, field]}
        multiline
        textAlignVertical="top"
        placeholder={strings.feedback.placeholder}
        placeholderTextColor={colors.inkSoft}
        value={message}
        onChangeText={setMessage}
        accessibilityLabel={strings.feedback.placeholder}
      />
      <View style={[styles.emailRow, field]}>
        <AppText variant="body" style={styles.emailLabel}>
          {strings.feedback.includeEmail}
        </AppText>
        <TextInput
          testID="feedback-email"
          style={[styles.email, { color: colors.ink }]}
          placeholder={strings.feedback.emailPlaceholder}
          placeholderTextColor={colors.inkSoft}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          accessibilityLabel={strings.feedback.includeEmail}
        />
      </View>
    </SettingsSubpage>
  );
}

const styles = StyleSheet.create({
  message: {
    minHeight: 170,
    borderWidth: hairline,
    borderRadius: radius.card,
    padding: spacing.md + spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.body,
  },
  emailRow: {
    marginTop: spacing.sm + spacing.xs,
    borderWidth: hairline,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md + spacing.xs,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  emailLabel: {
    flexShrink: 1,
  },
  email: {
    flex: 1,
    textAlign: "right",
    fontFamily: fontFamily.regular,
    fontSize: typeScale.body,
    paddingVertical: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
  },
  mark: {
    marginBottom: spacing.sm,
  },
  note: {
    maxWidth: 340,
  },
  bottom: {
    paddingBottom: spacing.md,
  },
});
