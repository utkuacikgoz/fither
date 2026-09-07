import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import {
  motion,
  onUnlock,
  radius,
  spacing,
  unlockAccent,
  unlockBg,
} from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { loadLibrary } from "../../session/load-library";
import { skillFigureId } from "../../session/skill-name";
import { useSessionStore } from "../../state/session-store";
import { shareSkill } from "./share-skill";
import { SkillShareCard } from "./skill-share-card";

// The only loud screen in the app: black full-screen, the green as a rule
// and as the drawn movement, the skill name set huge (ADR-0017,
// owner-approved 2026-09-07). Two beats, one decision each: the moment
// (Continue in white, Share this quiet), and the share (the card she
// sends, Share this, Not now back to the moment).
//
// Sequencing (2026-09-02 audit): roughly half of unlock sessions award
// more than one skill, so the screen celebrates ONE skill at a time —
// the full moment for each, Continue advancing to the next until the
// last Continue leaves. No count caption, no progress bar: the skill
// name IS the focal point, and a "1 of 2" would recast the celebration
// as a queue to clear.

interface UnlockScreenProps {
  onContinue: () => void;
}

// Sharing: the rendered card as an image, text as the fallback — see
// share-skill.ts. The card's ref is the artifact.
export function UnlockScreen({ onContinue }: UnlockScreenProps) {
  const cardRef = useRef<View>(null);
  const sharing = useRef(false);
  const finish = useSessionStore((s) => s.finish);
  const skills = finish?.unlockedSkills ?? [];
  const [index, setIndex] = useState(0);
  const [beat, setBeat] = useState<"moment" | "share">("moment");
  const skill = skills[index];
  const isLast = index >= skills.length - 1;
  const library = loadLibrary();

  // The most generous animation in the product (ADR-0013 — the unlock is
  // the emotional payoff and it EARNS the choreography every other screen
  // spends sparingly). Four beats, staggered: the eyebrow arrives, the
  // green rule draws itself out from the centre, the figure and then the
  // name rise into place. It plays on arrival AND on each subsequent
  // skill, so a second unlock reads as its own moment rather than a
  // content swap. Reduce Motion lands every value at its final state.
  const reduceMotion = useReducedMotion();
  const eyebrow = useRef(new Animated.Value(0)).current;
  const rule = useRef(new Animated.Value(0)).current;
  const figure = useRef(new Animated.Value(0)).current;
  const name = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const values = [eyebrow, rule, figure, name];
    if (reduceMotion) {
      values.forEach((v) => v.setValue(1));
      return;
    }
    values.forEach((v) => v.setValue(0));
    const step = (value: Animated.Value, delay: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration: motion.fadeMs,
        delay,
        useNativeDriver: true,
      });
    const animation = Animated.parallel([
      step(eyebrow, 0),
      step(rule, motion.staggerMs),
      step(figure, motion.staggerMs * 2),
      step(name, motion.staggerMs * 3),
    ]);
    animation.start();
    return () => animation.stop();
  }, [index, eyebrow, rule, figure, name, reduceMotion]);

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
      setBeat("moment");
      setIndex((i) => i + 1);
    }
  };

  const handleShare = () => {
    if (!skill) return;
    // One sheet at a time: a double tap must not start a second capture
    // whose sheet UIKit silently refuses to present.
    if (sharing.current) return;
    sharing.current = true;
    void shareSkill({ skillName: skill.movementName, card: cardRef }).finally(
      () => {
        sharing.current = false;
      },
    );
  };

  if (skill && beat === "share") {
    const id = `unlock-share-${skill.pattern}-${skill.tier}`;
    return (
      <Screen backgroundColor={unlockBg}>
        <View style={styles.center}>
          <SkillShareCard
            key={`${skill.pattern}-${skill.tier}`}
            ref={cardRef}
            skillName={skill.movementName}
            movementId={skillFigureId(library, skill.pattern, skill.tier)}
            testID={`${id}-card`}
          />
        </View>
        <View style={styles.bottom}>
          <PrimaryButton
            testID={`${id}-share`}
            label={strings.share.action}
            onPress={handleShare}
          />
          <QuietButton
            testID="unlock-share-not-now"
            label={strings.share.card.notNow}
            onPress={() => setBeat("moment")}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={unlockBg}>
      <Animated.View style={styles.center}>
        <Animated.View style={entrance(eyebrow)}>
          <AppText variant="caption" color={unlockAccent}>
            {strings.unlock.heading}
          </AppText>
        </Animated.View>
        {/* The rule draws itself out from the centre — the one flourish
            the product allows itself, and only here. */}
        <Animated.View
          style={[
            styles.rule,
            { opacity: rule, transform: [{ scaleX: rule }] },
          ]}
        />
        {skill ? (
          <>
            <Animated.View style={[styles.figure, entrance(figure)]}>
              {/* The skill drawn in the green: the same figure she will
                  meet in the session, celebrated once here. */}
              <MovementFigure
                movementId={skillFigureId(library, skill.pattern, skill.tier)}
                size="hero"
                tone="accent"
                animate
                testID={`unlock-figure-${skill.pattern}-${skill.tier}`}
              />
            </Animated.View>
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
          </>
        ) : null}
        <Animated.View style={entrance(name)}>
          <AppText variant="bodySoft" style={styles.note}>
            {strings.unlock.note}
          </AppText>
        </Animated.View>
      </Animated.View>
      <View style={styles.bottom}>
        <PrimaryButton
          testID="unlock-continue"
          tone="inverse"
          label={strings.unlock.continueLabel}
          onPress={handleContinue}
        />
        {skill ? (
          <QuietButton
            testID={`unlock-share-${skill.pattern}-${skill.tier}`}
            label={strings.share.action}
            onPress={() => setBeat("share")}
          />
        ) : null}
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
  figure: {
    marginTop: spacing.md,
  },
  skillName: {
    textAlign: "center",
  },
  rule: {
    width: spacing.xl,
    height: spacing.xs / 2,
    borderRadius: radius.pill,
    backgroundColor: unlockAccent,
  },
  note: {
    marginTop: spacing.xs,
    textAlign: "center",
  },
  bottom: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});
