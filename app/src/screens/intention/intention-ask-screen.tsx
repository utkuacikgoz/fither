import { StyleSheet, View } from "react-native";
import type { WeeklyTarget } from "@fither/engine";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { AnswerRow } from "../../design/primitives/answer-row";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { motion, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useIntentionStore } from "../../state/intention-store";

// The weekly intention ask (owner brief 2026-09-07, wave 2; mockup
// weekly-intention, approved). One question, one decision, daily-prompt
// style: three full-width rows, auto-advance on tap, no Next button. It
// runs once, after her first close with an attempted block (the route
// and lib/close-flow.ts own when); the store owns the answer and the
// asked flag. "No target" is an answer with the same dignity as the
// other two — it sets nothing and still ends the ask.

interface IntentionAskScreenProps {
  /** Leave the ask (whatever she chose). */
  onDone: () => void;
}

/** The three rows, in the mockup's order, each paired with its event value. */
const OPTIONS: ReadonlyArray<{
  target: WeeklyTarget;
  label: string;
  event: "two" | "three" | "none";
  testID: string;
}> = [
  { target: 2, label: strings.intention.two, event: "two", testID: "intention-two" },
  { target: 3, label: strings.intention.three, event: "three", testID: "intention-three" },
  { target: null, label: strings.intention.none, event: "none", testID: "intention-none" },
];

export function IntentionAskScreen({ onDone }: IntentionAskScreenProps) {
  const setTarget = useIntentionStore((s) => s.setTarget);
  const reduceMotion = useReducedMotion();

  const choose = (option: (typeof OPTIONS)[number]) => {
    // Choosing IS the answer: setTarget also marks the ask as done, so
    // a re-entry can never ask again (intention-store).
    setTarget(option.target);
    track("weekly_intention_set", { target: option.event });
    onDone();
  };

  return (
    <Screen>
      <FadeIn
        reduceMotion={reduceMotion}
        rise={motion.riseDistance}
        style={styles.center}
      >
        <AppText variant="display" accessibilityRole="header" style={styles.question}>
          {strings.intention.question}
        </AppText>
        <AppText variant="bodySoft" style={styles.lead}>
          {strings.intention.lead}
        </AppText>
        <View>
          {/* Three answers entering like every other short answer list;
              each is hittable from its first frame (ADR-0013). */}
          {OPTIONS.map((option, index) => (
            <AnswerRow key={option.testID} index={index} reduceMotion={reduceMotion}>
              <RowButton
                testID={option.testID}
                label={option.label}
                onPress={() => choose(option)}
              />
            </AnswerRow>
          ))}
        </View>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
  },
  question: {
    marginBottom: spacing.sm + spacing.xs,
  },
  lead: {
    marginBottom: spacing.lg + spacing.xs,
  },
});
