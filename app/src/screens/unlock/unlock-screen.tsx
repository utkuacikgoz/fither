import { useEffect, useRef, useState } from "react";
import { Animated, Share, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { Screen } from "../../design/primitives/screen";
import {
  lightColors,
  motion,
  onUnlock,
  spacing,
  unlockBg,
} from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useSessionStore } from "../../state/session-store";
import { SkillShareCard } from "./skill-share-card";

// The only loud screen in the app: deep sage full-screen, gold accent,
// the skill name set huge. One button: Continue — the share card is an
// invitation beside it, never a rival call to action.
//
// Sequencing (2026-09-02 audit): roughly half of unlock sessions award
// more than one skill, so the screen celebrates ONE skill at a time —
// the full moment for each, Continue advancing to the next until the
// last Continue leaves. No count caption, no progress bar: the skill
// name IS the focal point, and a "1 of 2" would recast the celebration
// as a queue to clear. The changing name plus the per-skill entrance
// fade is the signifier that a new moment began.

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
  const [index, setIndex] = useState(0);
  const skill = skills[index];
  const isLast = index >= skills.length - 1;

  // The unlock moment's one considered animation, applied PER skill:
  // each subsequent skill enters on its own gentle fade so it reads as
  // its own moment, not a content swap. The FIRST skill renders exactly
  // as it always has (opacity settled at 1, no entrance) — a single
  // unlock is pixel-identical to what shipped before sequencing.
  const reduceMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const shownIndex = useRef(index);
  useEffect(() => {
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: motion.fadeMs,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, opacity, reduceMotion]);

  const handleContinue = () => {
    if (isLast) {
      onContinue();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <Screen backgroundColor={unlockBg}>
      <Animated.View style={[styles.center, { opacity }]}>
        <AppText variant="caption" color={lightColors.gold}>
          {strings.unlock.heading}
        </AppText>
        {skill ? (
          <AppText
            key={`${skill.pattern}-${skill.tier}`}
            variant="display"
            color={onUnlock}
            style={styles.skillName}
            testID="unlock-skill-name"
          >
            {skill.movementName}
          </AppText>
        ) : null}
        <AppText variant="bodySoft" color={onUnlock} style={styles.note}>
          {strings.unlock.note}
        </AppText>
      </Animated.View>
      <Animated.View style={[styles.cards, { opacity }]}>
        {skill ? (
          <SkillShareCard
            key={`${skill.pattern}-${skill.tier}`}
            skillName={skill.movementName}
            onShare={() => shareSkill(skill.movementName)}
            testID={`unlock-share-${skill.pattern}-${skill.tier}`}
          />
        ) : null}
      </Animated.View>
      <View style={styles.bottom}>
        <PrimaryButton
          testID="unlock-continue"
          tone="inverse"
          label={strings.unlock.continueLabel}
          onPress={handleContinue}
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
