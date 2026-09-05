import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { BodyArea, Equipment } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AnswerRow } from "../../design/primitives/answer-row";
import { AppText } from "../../design/primitives/app-text";
import { BrandMark } from "../../design/primitives/brand-mark";
import { FadeIn } from "../../design/primitives/fade-in";
import { FlowProgress } from "../../design/primitives/flow-progress";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { motion, spacing } from "../../design/tokens";
import { BODY_AREAS } from "../../lib/body-areas";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useSettingsStore } from "../../state/settings-store";

// Onboarding (ADR-0009 §1): the three drafted screens — welcome,
// equipment, persistent avoid-list — one decision per screen,
// auto-advance on tap, no Next buttons. Runs once; completing it persists
// through the settings store and hands off to the daily prompt. Nothing
// else may spend Gate 3 budget here: no account, no email, no paywall.
//
// ADR-0013 gives it the same language as the rest of the app without
// spending a tap: the welcome carries the drawn mark (it is the brand
// moment — ADR-0006 gives the tagline to this headline), the two
// questions count themselves, and the equipment options show what they
// mean with the figure of a day-one movement each. Begin and every
// answer row are tappable from the first frame.

// "Just me and the floor" vs "A sturdy chair too": the one thing the
// engine must know before day one is chair availability (draft-strings
// §1). A wall exists in every room she'd train in, so it stays available
// on both paths — same reasoning as the settings-store default.
const FLOOR_ONLY: Equipment[] = ["none", "wall"];
const WITH_CHAIR: Equipment[] = ["none", "chair", "wall"];

/**
 * The figure beside each equipment option: a tier-one movement she can
 * actually meet on day one with exactly that equipment — the floor row
 * shows floor work, the chair row shows the chair in use. Ids are library
 * data, so a test pins that each still exists at tier one with the
 * matching equipment; a library rename fails there, never silently here.
 */
export const EQUIPMENT_FIGURES = {
  floorOnly: "glute-bridge",
  chair: "supported-sit-to-stand",
} as const;

type Step = "welcome" | "equipment" | "avoid";

/** The two questions, in order — the welcome is a landing, not a step. */
const QUESTIONS: Step[] = ["equipment", "avoid"];

interface OnboardingScreenProps {
  /** Onboarding is complete and persisted — hand off to the daily prompt. */
  onDone: () => void;
}

export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<Step>("welcome");
  const [equipment, setEquipment] = useState<Equipment[]>(WITH_CHAIR);
  const [avoid, setAvoid] = useState<BodyArea[]>([]);

  const finish = (alwaysAvoid: BodyArea[]) => {
    completeOnboarding(equipment, alwaysAvoid);
    onDone();
  };

  const toggleArea = (area: BodyArea) => {
    setAvoid((current) =>
      current.includes(area)
        ? current.filter((a) => a !== area)
        : [...current, area],
    );
  };

  if (step === "welcome") {
    return (
      <Screen>
        {/* The welcome is the one unbounded text stack before the
            session (mark + title + body): at 2× Dynamic Type on a small
            phone it overran Begin. Same treatment as the player's intro
            — scrolls when it must, centres exactly as before when it
            fits (reviewer should-fix). */}
        <ScrollView
          style={styles.welcomeScroll}
          contentContainerStyle={styles.welcomeCenter}
          showsVerticalScrollIndicator
        >
          {/* Three beats — mark, headline, body — in the unlock's own
              rhythm. The button below is outside the choreography and
              tappable throughout: the moment costs her nothing. */}
          <FadeIn reduceMotion={reduceMotion} rise={motion.riseDistance}>
            <View style={styles.mark}>
              <BrandMark testID="onboarding-mark" />
            </View>
          </FadeIn>
          <FadeIn
            reduceMotion={reduceMotion}
            rise={motion.riseDistance}
            delayMs={motion.staggerMs}
          >
            <AppText variant="title" accessibilityRole="header">
              {strings.onboarding.welcome.headline}
            </AppText>
          </FadeIn>
          <FadeIn
            reduceMotion={reduceMotion}
            rise={motion.riseDistance}
            delayMs={motion.staggerMs * 2}
          >
            <AppText variant="bodySoft" style={styles.welcomeBody}>
              {strings.onboarding.welcome.body}
            </AppText>
          </FadeIn>
        </ScrollView>
        <View style={styles.bottom}>
          <PrimaryButton
            testID="onboarding-begin"
            label={strings.onboarding.welcome.cta}
            onPress={() => setStep("equipment")}
          />
        </View>
      </Screen>
    );
  }

  const flow = (
    <View style={styles.flow}>
      <FlowProgress
        testID="onboarding-flow"
        total={QUESTIONS.length}
        current={QUESTIONS.indexOf(step) + 1}
        reduceMotion={reduceMotion}
      />
    </View>
  );

  if (step === "equipment") {
    return (
      <Screen>
        {flow}
        <FadeIn
          reduceMotion={reduceMotion}
          rise={motion.riseDistance}
          style={styles.question}
        >
          <AppText
            variant="title"
            style={styles.title}
            accessibilityRole="header"
          >
            {strings.onboarding.equipment.question}
          </AppText>
          <AnswerRow index={0} reduceMotion={reduceMotion}>
            <RowButton
              testID="onboarding-floor-only"
              label={strings.onboarding.equipment.options.floorOnly}
              figure={EQUIPMENT_FIGURES.floorOnly}
              onPress={() => {
                setEquipment(FLOOR_ONLY);
                setStep("avoid");
              }}
            />
          </AnswerRow>
          <AnswerRow index={1} reduceMotion={reduceMotion}>
            <RowButton
              testID="onboarding-chair"
              label={strings.onboarding.equipment.options.chair}
              figure={EQUIPMENT_FIGURES.chair}
              onPress={() => {
                setEquipment(WITH_CHAIR);
                setStep("avoid");
              }}
            />
          </AnswerRow>
        </FadeIn>
      </Screen>
    );
  }

  return (
    <Screen>
      {flow}
      <ScrollView
        style={styles.question}
        contentContainerStyle={styles.scrollContent}
        // Signifiers: seven areas plus the confirm run past the fold on
        // a small phone — the same fix the prompt's soreness list got.
        showsVerticalScrollIndicator
      >
        <FadeIn reduceMotion={reduceMotion} rise={motion.riseDistance}>
          <AppText
            variant="title"
            style={styles.title}
            accessibilityRole="header"
          >
            {strings.onboarding.avoid.question}
          </AppText>
          {avoid.length === 0 && (
            <RowButton
              testID="onboarding-avoid-nothing"
              // One shared string with the daily prompt's soreness default —
              // the same warm "All good" she'll tap every day from tomorrow.
              // Hidden the moment she picks an area (audit S5), exactly like
              // the prompt's soreness step: one constraint, one behaviour —
              // "All good" can never silently discard her picks.
              label={strings.prompt.soreness.allGood}
              onPress={() => finish([])}
            />
          )}
          {BODY_AREAS.map((area) => (
            <RowButton
              key={area}
              testID={`onboarding-avoid-${area}`}
              label={strings.prompt.soreness.areas[area]}
              selected={avoid.includes(area)}
              multiSelect
              onPress={() => toggleArea(area)}
            />
          ))}
          {avoid.length > 0 && (
            <View style={styles.confirm}>
              <AppText
                variant="caption"
                style={styles.countCue}
                testID="onboarding-avoid-count"
              >
                {strings.prompt.soreness.areasNoted(avoid.length)}
              </AppText>
              <PrimaryButton
                testID="onboarding-avoid-confirm"
                label={strings.onboarding.avoid.confirm}
                onPress={() => finish(avoid)}
              />
            </View>
          )}
        </FadeIn>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcomeScroll: {
    flex: 1,
  },
  welcomeCenter: {
    flexGrow: 1,
    justifyContent: "center",
  },
  mark: {
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  welcomeBody: {
    marginTop: spacing.md,
  },
  bottom: {
    paddingBottom: spacing.md,
  },
  flow: {
    marginTop: spacing.md,
  },
  question: {
    marginTop: spacing.xl,
  },
  title: {
    marginBottom: spacing.xl,
  },
  confirm: {
    marginTop: spacing.md,
  },
  countCue: {
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
});
