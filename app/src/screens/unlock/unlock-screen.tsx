import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { Screen } from "../../design/primitives/screen";
import {
  lightColors,
  motion,
  onUnlock,
  radius,
  spacing,
  unlockBg,
} from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useSessionStore } from "../../state/session-store";
import { shareSkill } from "./share-skill";
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

// Sharing: the rendered card as an image, text as the fallback — see
// share-skill.ts. The card's ref is the artifact.
export function UnlockScreen({ onContinue }: UnlockScreenProps) {
  const cardRef = useRef<View>(null);
  const finish = useSessionStore((s) => s.finish);
  const skills = finish?.unlockedSkills ?? [];
  const [index, setIndex] = useState(0);
  const skill = skills[index];
  const isLast = index >= skills.length - 1;

  // The most generous animation in the product (ADR-0013 — the unlock is
  // the emotional payoff and it EARNS the choreography every other screen
  // spends sparingly). Three beats, staggered: the "New skill" eyebrow
  // arrives, the gold rule draws itself out from the centre, and the
  // skill name rises into place. It plays on arrival AND on each
  // subsequent skill, so a second unlock reads as its own moment rather
  // than a content swap. Reduce Motion lands every value at its final
  // state — never a half-played frame.
  const reduceMotion = useReducedMotion();
  const eyebrow = useRef(new Animated.Value(0)).current;
  const rule = useRef(new Animated.Value(0)).current;
  const name = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const values = [eyebrow, rule, name, card];
    if (reduceMotion) {
      values.forEach((v) => v.setValue(1));
      return;
    }
    values.forEach((v) => v.setValue(0));
    const beat = (value: Animated.Value, delay: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration: motion.fadeMs,
        delay,
        useNativeDriver: true,
      });
    const animation = Animated.parallel([
      beat(eyebrow, 0),
      beat(rule, motion.staggerMs),
      beat(name, motion.staggerMs * 2),
      beat(card, motion.staggerMs * 4),
    ]);
    animation.start();
    return () => animation.stop();
  }, [index, eyebrow, rule, name, card, reduceMotion]);

  /** Rise + fade for a beat: the entrance every screen shares. */
  const entrance = (value: Animated.Value) => ({
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [motion.riseDistance, 0],
        }),
      },
    ],
  });

  const handleContinue = () => {
    if (isLast) {
      onContinue();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <Screen backgroundColor={unlockBg}>
      <Animated.View style={styles.center}>
        {/* Audit S8: gold text on sage is ~1.75:1 — far under AA. The
            heading reads in bone; gold stays decorative as a short rule
            beneath it (the share card's established pattern). */}
        <Animated.View style={entrance(eyebrow)}>
          <AppText variant="caption" color={onUnlock}>
            {strings.unlock.heading}
          </AppText>
        </Animated.View>
        {/* The rule draws itself out from the centre — the one flourish
            the product allows itself, and only here. */}
        <Animated.View
          style={[
            styles.goldRule,
            { opacity: rule, transform: [{ scaleX: rule }] },
          ]}
        />
        {skill ? (
          <Animated.View style={entrance(name)}>
            <AppText
              key={`${skill.pattern}-${skill.tier}`}
              variant="display"
              color={onUnlock}
              style={styles.skillName}
              testID="unlock-skill-name"
            >
              {skill.movementName}
            </AppText>
          </Animated.View>
        ) : null}
        <Animated.View style={entrance(name)}>
          <AppText variant="bodySoft" color={onUnlock} style={styles.note}>
            {strings.unlock.note}
          </AppText>
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.cards, entrance(card)]}>
        {skill ? (
          <SkillShareCard
            key={`${skill.pattern}-${skill.tier}`}
            ref={cardRef}
            skillName={skill.movementName}
            onShare={() => {
              void shareSkill({ skillName: skill.movementName, card: cardRef });
            }}
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
  goldRule: {
    width: spacing.xl,
    height: spacing.xs / 2,
    borderRadius: radius.pill,
    backgroundColor: lightColors.gold,
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
