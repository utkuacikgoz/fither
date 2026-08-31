import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { Screen } from "../../design/primitives/screen";
import { lightColors, onUnlock, spacing, unlockBg } from "../../design/tokens";
import { useSessionStore } from "../../state/session-store";

// The only loud screen in the app: deep sage full-screen, gold accent,
// the skill name set huge. One button: Continue.

interface UnlockScreenProps {
  onContinue: () => void;
}

export function UnlockScreen({ onContinue }: UnlockScreenProps) {
  const finish = useSessionStore((s) => s.finish);
  const skills = finish?.unlockedSkills ?? [];

  return (
    <Screen backgroundColor={unlockBg}>
      <View style={styles.center}>
        <AppText variant="caption" color={lightColors.gold}>
          {strings.unlock.heading}
        </AppText>
        {skills.map((skill) => (
          <AppText
            key={`${skill.pattern}-${skill.tier}`}
            variant="display"
            color={onUnlock}
            style={styles.skillName}
            testID="unlock-skill-name"
          >
            {skill.movementName}
          </AppText>
        ))}
        <AppText variant="bodySoft" color={onUnlock} style={styles.note}>
          {strings.unlock.note}
        </AppText>
      </View>
      <View style={styles.bottom}>
        <PrimaryButton
          testID="unlock-continue"
          tone="inverse"
          label={strings.unlock.continueLabel}
          onPress={onContinue}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  skillName: {
    textAlign: "center",
  },
  note: {
    marginTop: spacing.md,
  },
  bottom: {
    paddingBottom: spacing.md,
  },
});
