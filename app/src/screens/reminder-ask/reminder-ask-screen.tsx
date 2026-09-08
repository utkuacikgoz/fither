import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { AnswerRow } from "../../design/primitives/answer-row";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { useTheme } from "../../design/theme";
import { motion, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { REMINDER_SLOTS, type ReminderSlot } from "../../notifications/notifications";
import { useReminderStore } from "../../state/reminder-store";

// The one in-context notification ask (launch checklist: after the first
// completed session, when the value is obvious — never at first open).
// Its own interstitial, not a section on the finish screen: the finish
// screen's one decision is acknowledging the close, and this screen's is
// the invitation — one decision per screen keeps both honest. Two steps,
// daily-prompt style: the rationale (allow / not now), then — only after
// the OS actually granted — the time question. An invitation throughout:
// declining here or at the OS dialog ends the matter for good; Settings
// is the only way back in.

interface ReminderAskScreenProps {
  /** Leave the interstitial (whatever she chose). */
  onDone: () => void;
}

export function ReminderAskScreen({ onDone }: ReminderAskScreenProps) {
  const allow = useReminderStore((s) => s.allow);
  const decline = useReminderStore((s) => s.decline);
  const chooseSlot = useReminderStore((s) => s.chooseSlot);

  const reduceMotion = useReducedMotion();
  const colors = useTheme();
  const [step, setStep] = useState<"rationale" | "time">("rationale");
  const [busy, setBusy] = useState(false);

  const handleAllow = async () => {
    if (busy) return;
    setBusy(true);
    const granted = await allow();
    setBusy(false);
    // reminder_ask: her yes, or her yes that iOS then refused.
    track("reminder_ask", { outcome: granted ? "allow" : "osDenied" });
    if (granted) {
      setStep("time");
    } else {
      // OS dialog declined (or errored): asked is recorded, nothing
      // schedules, and she moves on without another word.
      onDone();
    }
  };

  const handleDecline = () => {
    decline();
    track("reminder_ask", { outcome: "decline" });
    onDone();
  };

  const handleSlot = async (slot: ReminderSlot) => {
    if (busy) return;
    setBusy(true);
    // If scheduling fails the slot stays unset — Settings can retry any
    // day; the close flow never stalls on it.
    await chooseSlot(slot);
    setBusy(false);
    onDone();
  };

  if (step === "time") {
    return (
      <Screen>
        <FadeIn
          reduceMotion={reduceMotion}
          rise={motion.riseDistance}
          style={styles.body}
        >
          <AppText variant="title" style={styles.title} accessibilityRole="header">
            {strings.notifications.time.question}
          </AppText>
          {/* Three real hours entering like every other short answer
              list; each answers on its first frame. No flow indicator
              here on purpose: this step only exists after the OS
              granted, so a bar on the rationale would promise a second
              step that may never come. */}
          {REMINDER_SLOTS.map((slot, index) => (
            <AnswerRow key={slot} index={index} reduceMotion={reduceMotion}>
              <RowButton
                testID={`reminder-ask-${slot}`}
                label={strings.notifications.time[slot]}
                onPress={() => {
                  void handleSlot(slot);
                }}
              />
            </AnswerRow>
          ))}
        </FadeIn>
      </Screen>
    );
  }

  return (
    <Screen>
      <FadeIn
        reduceMotion={reduceMotion}
        rise={motion.riseDistance}
        style={styles.center}
      >
        {/* The ask (ADR-0017, owner-approved 2026-09-07): a drawn clock,
            the question as the headline, the one-line promise beneath. */}
        <View
          style={[styles.clock, { borderColor: colors.accent }]}
          importantForAccessibility="no"
          accessibilityElementsHidden
          testID="reminder-ask-glyph"
        >
          <View style={[styles.hourHand, { backgroundColor: colors.accent }]} />
          <View style={[styles.minuteHand, { backgroundColor: colors.accent }]} />
        </View>
        <AppText variant="display" accessibilityRole="header" style={styles.headline}>
          {strings.notifications.rationale.headline}
        </AppText>
        <AppText variant="bodySoft" style={styles.rationale}>
          {strings.notifications.rationale.line}
        </AppText>
      </FadeIn>
      <View style={styles.bottom}>
        <PrimaryButton
          testID="reminder-ask-allow"
          label={strings.notifications.rationale.allow}
          onPress={() => {
            void handleAllow();
          }}
        />
        <QuietButton
          testID="reminder-ask-decline"
          label={strings.notifications.rationale.decline}
          onPress={handleDecline}
        />
      </View>
    </Screen>
  );
}

/** The drawn clock: a hairline circle with two hands, in the accent. */
const CLOCK_SIZE = spacing.xxl + spacing.sm;
const CLOCK_STROKE = 2;

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
  },
  clock: {
    width: CLOCK_SIZE,
    height: CLOCK_SIZE,
    borderRadius: CLOCK_SIZE / 2,
    borderWidth: CLOCK_STROKE,
    marginBottom: spacing.lg,
  },
  hourHand: {
    position: "absolute",
    left: CLOCK_SIZE / 2 - CLOCK_STROKE * 1.5,
    top: CLOCK_SIZE / 5,
    width: CLOCK_STROKE,
    height: CLOCK_SIZE / 3,
  },
  minuteHand: {
    position: "absolute",
    left: CLOCK_SIZE / 2 - CLOCK_STROKE * 1.5,
    top: CLOCK_SIZE / 2 - CLOCK_STROKE * 1.5,
    width: CLOCK_SIZE / 4,
    height: CLOCK_STROKE,
  },
  headline: {
    marginBottom: spacing.md,
  },
  rationale: {},
  body: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    marginBottom: spacing.lg,
  },
  bottom: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});
