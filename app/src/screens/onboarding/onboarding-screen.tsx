import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { BodyArea, Equipment } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
import { BODY_AREAS } from "../../lib/body-areas";
import { useSettingsStore } from "../../state/settings-store";

// Onboarding (ADR-0009 §1): the three drafted screens — welcome,
// equipment, persistent avoid-list — one decision per screen,
// auto-advance on tap, no Next buttons. Runs once; completing it persists
// through the settings store and hands off to the daily prompt. Nothing
// else may spend Gate 3 budget here: no account, no email, no paywall.

// "Just me and the floor" vs "A sturdy chair too": the one thing the
// engine must know before day one is chair availability (draft-strings
// §1). A wall exists in every room she'd train in, so it stays available
// on both paths — same reasoning as the settings-store default.
const FLOOR_ONLY: Equipment[] = ["none", "wall"];
const WITH_CHAIR: Equipment[] = ["none", "chair", "wall"];

type Step = "welcome" | "equipment" | "avoid";

interface OnboardingScreenProps {
  /** Onboarding is complete and persisted — hand off to the daily prompt. */
  onDone: () => void;
}

export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

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
        <View style={styles.welcomeCenter}>
          <AppText variant="title">{strings.onboarding.welcome.headline}</AppText>
          <AppText variant="bodySoft" style={styles.welcomeBody}>
            {strings.onboarding.welcome.body}
          </AppText>
        </View>
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

  if (step === "equipment") {
    return (
      <Screen>
        <View style={styles.question}>
          <AppText variant="title" style={styles.title}>
            {strings.onboarding.equipment.question}
          </AppText>
          <RowButton
            testID="onboarding-floor-only"
            label={strings.onboarding.equipment.options.floorOnly}
            onPress={() => {
              setEquipment(FLOOR_ONLY);
              setStep("avoid");
            }}
          />
          <RowButton
            testID="onboarding-chair"
            label={strings.onboarding.equipment.options.chair}
            onPress={() => {
              setEquipment(WITH_CHAIR);
              setStep("avoid");
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        style={styles.question}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title" style={styles.title}>
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcomeCenter: {
    flex: 1,
    justifyContent: "center",
  },
  welcomeBody: {
    marginTop: spacing.md,
  },
  bottom: {
    paddingBottom: spacing.md,
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
