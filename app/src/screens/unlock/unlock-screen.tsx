import { Share, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { Screen } from "../../design/primitives/screen";
import { lightColors, onUnlock, spacing, unlockBg } from "../../design/tokens";
import { useSessionStore } from "../../state/session-store";
import { SkillShareCard } from "./skill-share-card";

// The only loud screen in the app: deep sage full-screen, gold accent,
// the skill name set huge. One button: Continue — the share card is an
// invitation beside it, never a rival call to action.

interface UnlockScreenProps {
  onContinue: () => void;
}

// v1 decision (do not revisit here): sharing is TEXT through the system
// sheet — no view-shot dependency; image export is a later, isolated swap.
function shareSkill(skillName: string): void {
  // The Pressable's pressed state is the immediate feedback; the sheet
  // itself is the OS's. A dismissed sheet RESOLVES (dismissedAction) and
  // is not an error. A rejection means the sheet never opened — no
  // existing error string fits calmly, so we stay quiet rather than
  // alarm her on her proudest screen.
  void Share.share({ message: strings.share.message(skillName) }).catch(() => {
    // Intentionally silent.
  });
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
      <View style={styles.cards}>
        {skills.map((skill) => (
          <SkillShareCard
            key={`${skill.pattern}-${skill.tier}`}
            skillName={skill.movementName}
            onShare={() => shareSkill(skill.movementName)}
            testID={`unlock-share-${skill.pattern}-${skill.tier}`}
          />
        ))}
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
  cards: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  bottom: {
    paddingBottom: spacing.md,
  },
});
