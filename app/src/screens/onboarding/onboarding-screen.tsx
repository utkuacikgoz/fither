import { ScrollView, StyleSheet, View } from "react-native";
import type { Equipment } from "@fither/engine";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { AnswerRow } from "../../design/primitives/answer-row";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { FlowProgress } from "../../design/primitives/flow-progress";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { motion, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import {
  FLOOR_ONLY_EQUIPMENT,
  useSettingsStore,
  WITH_CHAIR_EQUIPMENT,
} from "../../state/settings-store";

// Onboarding (ADR-0009 §1; owner brief 2026-09-07, wave 1 "first use"):
// one screen, one decision. The welcome-only screen is retired — the
// brand promise (ADR-0006's tagline) now heads the equipment question,
// so the first screen she reads is also the first decision she makes,
// and the mockup (docs/design/mockups/onboarding-equipment-first.html)
// carries no mark here. The persistent avoid-list step is retired for
// first use too: restrictions are asked ONCE, on the first session's
// soreness step, which offers to remember the picks (daily-prompt
// screen). Auto-advance on tap, no Next button. Runs once; completing
// it persists through the settings store and hands off to the daily
// prompt. Nothing else may spend Gate 3 budget here: no account, no
// email, no paywall.
//
// ADR-0013 gives it the same language as the rest of the app without
// spending a tap: the rail counts what remains, and the equipment
// options show what they mean with the figure of a day-one movement
// each. Every answer row is tappable from the first frame.

// "Just me and the floor" vs "A sturdy chair too": the one thing the
// engine must know before day one is chair availability (draft-strings
// §1). A wall exists in every room she'd train in, so it stays available
// on both paths — same reasoning as the settings-store default.
// The store exports the two equipment sets (one definition — the
// settings editor reads the same ones), so a wall can never disappear on
// one path.

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

type Step = "equipment";

/**
 * The steps that remain, in order. One today: the rail (ADR-0017) counts
 * from this, so the flow's visible length is its real structure — a
 * step added without reading the Gate 3 rule would have to be added
 * HERE.
 */
const STEPS: Step[] = ["equipment"];

interface OnboardingScreenProps {
  /** Onboarding is complete and persisted — hand off to the daily prompt. */
  onDone: () => void;
}

export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const reduceMotion = useReducedMotion();
  const step: Step = "equipment";

  // Equipment is the one answer; the permanent avoid-list starts empty
  // and is offered on the first session's soreness step instead.
  const finish = (equipment: Equipment[]) => {
    completeOnboarding(equipment, []);
    // onboarding_complete (ADR-0024): which room she chose, nothing else.
    track("onboarding_complete", {
      equipment: equipment.includes("chair") ? "chair" : "floor",
    });
    onDone();
  };

  return (
    <Screen>
      <View style={styles.flow}>
        <FlowProgress
          testID="onboarding-flow"
          total={STEPS.length}
          current={STEPS.indexOf(step) + 1}
          reduceMotion={reduceMotion}
        />
      </View>
      {/* Headline + lead + two rows is the one unbounded text stack
          before the session: at 2× Dynamic Type on a small phone it
          scrolls when it must and sits exactly as drawn when it fits. */}
      <ScrollView
        style={styles.question}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <FadeIn reduceMotion={reduceMotion} rise={motion.riseDistance}>
          <AppText variant="display" accessibilityRole="header">
            {strings.onboarding.welcome.headline}
          </AppText>
          <AppText variant="bodySoft" style={styles.lead}>
            {strings.onboarding.equipment.lead}
          </AppText>
          <AnswerRow index={0} reduceMotion={reduceMotion}>
            <RowButton
              testID="onboarding-floor-only"
              reduceMotion={reduceMotion}
              label={strings.onboarding.equipment.options.floorOnly}
              figure={EQUIPMENT_FIGURES.floorOnly}
              onPress={() => finish(FLOOR_ONLY_EQUIPMENT)}
            />
          </AnswerRow>
          <AnswerRow index={1} reduceMotion={reduceMotion}>
            <RowButton
              testID="onboarding-chair"
              reduceMotion={reduceMotion}
              label={strings.onboarding.equipment.options.chair}
              figure={EQUIPMENT_FIGURES.chair}
              onPress={() => finish(WITH_CHAIR_EQUIPMENT)}
            />
          </AnswerRow>
        </FadeIn>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flow: {
    marginTop: spacing.md,
  },
  question: {
    marginTop: spacing.xl,
  },
  lead: {
    marginTop: spacing.sm + spacing.xs,
    marginBottom: spacing.xl,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
});
