import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
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

  const [step, setStep] = useState<"rationale" | "time">("rationale");
  const [busy, setBusy] = useState(false);

  const handleAllow = async () => {
    if (busy) return;
    setBusy(true);
    const granted = await allow();
    setBusy(false);
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
        <View style={styles.body}>
          <AppText variant="title" style={styles.title} accessibilityRole="header">
            {strings.notifications.time.question}
          </AppText>
          {REMINDER_SLOTS.map((slot) => (
            <RowButton
              key={slot}
              testID={`reminder-ask-${slot}`}
              label={strings.notifications.time[slot]}
              onPress={() => {
                void handleSlot(slot);
              }}
            />
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.center}>
        <AppText variant="bodyLarge" style={styles.rationale}>
          {strings.notifications.rationale.line}
        </AppText>
      </View>
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

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
  },
  rationale: {
    textAlign: "center",
  },
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
