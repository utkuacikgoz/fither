import { StyleSheet, View } from "react-native";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { useTheme } from "../../design/theme";
import { motion, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useSettingsStore } from "../../state/settings-store";

// The one voice ask (owner decision 2026-09-08): on the way into her
// first session, once ever. The same shape as the reminder ask — a drawn
// glyph, the question as the headline, one line beneath, the filled
// answer and its quiet peer — and the same honesty: either answer is a
// real setting she can change in Settings, and nothing is sent anywhere
// (the audio is bundled). No OS permission is involved: the phone's
// silent switch already wins inside the voice module.

interface VoiceAskScreenProps {
  /** Leave the ask (whatever she chose). */
  onDone: () => void;
}

export function VoiceAskScreen({ onDone }: VoiceAskScreenProps) {
  const answer = useSettingsStore((s) => s.answerVoiceAsk);
  const reduceMotion = useReducedMotion();
  const colors = useTheme();

  const choose = (voice: boolean) => {
    answer(voice);
    track("voice_ask", { voice });
    onDone();
  };

  return (
    <Screen>
      <FadeIn reduceMotion={reduceMotion} rise={motion.riseDistance} style={styles.center}>
        {/* A drawn wave in the accent: five bars, decorative only. */}
        <View
          style={styles.wave}
          importantForAccessibility="no"
          accessibilityElementsHidden
          testID="voice-ask-glyph"
        >
          {WAVE.map((height, index) => (
            <View key={index} style={[styles.bar, { height, backgroundColor: colors.accent }]} />
          ))}
        </View>
        <AppText variant="display" accessibilityRole="header" style={styles.headline}>
          {strings.voiceAsk.headline}
        </AppText>
        <AppText variant="bodySoft">{strings.voiceAsk.line}</AppText>
      </FadeIn>
      <View style={styles.bottom}>
        <PrimaryButton
          testID="voice-ask-allow"
          label={strings.voiceAsk.allow}
          onPress={() => choose(true)}
        />
        <QuietButton
          testID="voice-ask-decline"
          label={strings.voiceAsk.decline}
          onPress={() => choose(false)}
        />
      </View>
    </Screen>
  );
}

const WAVE = [spacing.md, spacing.xl, spacing.xxl + spacing.sm, spacing.xl + spacing.sm, spacing.lg];
const BAR = spacing.xs;

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
  },
  wave: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    height: spacing.xxl + spacing.sm,
    marginBottom: spacing.lg,
  },
  bar: {
    width: BAR,
    borderRadius: BAR / 2,
  },
  headline: {
    marginBottom: spacing.md,
  },
  bottom: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});
