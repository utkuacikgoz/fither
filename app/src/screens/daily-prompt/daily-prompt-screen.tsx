import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { BodyArea, DailyPrompt, Energy, SessionMinutes } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
import { BODY_AREAS } from "../../lib/body-areas";
import { todayIso } from "../../lib/dates";
import { useSessionStore } from "../../state/session-store";
import { useActiveSessionStore } from "../../state/active-session-store";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useLedgerStore } from "../../state/ledger-store";
import { useProfileStore } from "../../state/profile-store";
import { useSettingsStore } from "../../state/settings-store";
import { FirstMovementReadout } from "../dev-timing/first-movement-readout";

// The four decided questions (ADR-0003), one at a time. Four taps, no
// typing, under 15 seconds. "All good" is the one-tap soreness default.

const MINUTES: SessionMinutes[] = [10, 20, 30];
const ENERGY: Energy[] = ["low", "okay", "strong"];

type Step = "time" | "energy" | "quiet" | "soreness" | "noSession" | "error";

interface DailyPromptScreenProps {
  /** Called when the session is generated and ready to play. */
  onSessionReady: () => void;
  /**
   * True only on the prompt straight after onboarding: renders the
   * drafted handoff eyebrow atop the first question (ADR-0009 §1) —
   * zero extra taps, zero extra screens.
   */
  showHandoff?: boolean;
}

export function DailyPromptScreen({
  onSessionReady,
  showHandoff = false,
}: DailyPromptScreenProps) {
  const startSession = useSessionStore((s) => s.startSession);
  const equipment = useSettingsStore((s) => s.equipment);
  const alwaysAvoid = useSettingsStore((s) => s.alwaysAvoid);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const settingsFailed = useSettingsStore((s) => s.hydrationFailed);
  const profileHydrated = useProfileStore((s) => s.hydrated);
  const profileFailed = useProfileStore((s) => s.hydrationFailed);
  const ledgerHydrated = useLedgerStore((s) => s.hydrated);
  const ledgerFailed = useLedgerStore((s) => s.hydrationFailed);
  const activeHydrated = useActiveSessionStore((s) => s.hydrated);
  const activeFailed = useActiveSessionStore((s) => s.hydrationFailed);
  const entitlementHydrated = useEntitlementStore((s) => s.hydrated);
  const entitlementFailed = useEntitlementStore((s) => s.hydrationFailed);

  const [step, setStep] = useState<Step>("time");
  const [devTimingVisible, setDevTimingVisible] = useState(false);
  const [minutes, setMinutes] = useState<SessionMinutes | null>(null);
  const [energy, setEnergy] = useState<Energy | null>(null);
  const [quiet, setQuiet] = useState<boolean | null>(null);
  const [avoid, setAvoid] = useState<BodyArea[]>([]);

  const finish = (avoidAreas: BodyArea[]) => {
    if (minutes === null || energy === null || quiet === null) return;
    // The persistent avoid-list (onboarding) joins today's soreness picks
    // before the prompt reaches the engine — input assembly, not policy:
    // what "avoid" means to the session is decided entirely engine-side.
    const mergedAvoid = BODY_AREAS.filter(
      (area) => alwaysAvoid.includes(area) || avoidAreas.includes(area),
    );
    const prompt: DailyPrompt = {
      minutes,
      energy,
      quiet,
      avoid: mergedAvoid,
      date: todayIso(),
      equipment,
    };
    const result = startSession(prompt);
    if (result.ok) {
      onSessionReady();
    } else if (result.reason === "noSession") {
      setStep("noSession");
    } else {
      setStep("error");
    }
  };

  const toggleArea = (area: BodyArea) => {
    setAvoid((current) =>
      current.includes(area)
        ? current.filter((a) => a !== area)
        : [...current, area],
    );
  };

  const restart = () => {
    setStep("time");
    setMinutes(null);
    setEnergy(null);
    setQuiet(null);
    setAvoid([]);
  };

  const hydrated =
    settingsHydrated &&
    profileHydrated &&
    ledgerHydrated &&
    activeHydrated &&
    entitlementHydrated;
  const hydrationFailed =
    settingsFailed ||
    profileFailed ||
    ledgerFailed ||
    activeFailed ||
    entitlementFailed;

  if (!hydrated) {
    return (
      <Screen>
        <View style={styles.loading}>
          <AppText variant="bodySoft">
            {hydrationFailed
              ? strings.errors.storageUnavailable
              : strings.errors.preparing}
          </AppText>
        </View>
      </Screen>
    );
  }

  // Gate 3 dev readout (dev-timing/first-movement-readout.tsx). Overlay
  // state, not navigation: the prompt stays mounted, her answers survive.
  if (__DEV__ && devTimingVisible) {
    return <FirstMovementReadout onClose={() => setDevTimingVisible(false)} />;
  }

  const handoffVisible = showHandoff && step === "time";

  // In __DEV__ the day label doubles as the invisible entry to the Gate 3
  // timing readout — a long-press, so no tap in the real flow can hit it.
  // Release builds render the exact same tree as before: no wrapper.
  const dayLabel = (
    <AppText variant="caption" style={styles.dayLabel}>
      {handoffVisible
        ? strings.onboarding.handoff.eyebrow
        : strings.prompt.dayLabel}
    </AppText>
  );

  return (
    <Screen>
      {__DEV__ ? (
        <Pressable
          testID="dev-timing-entry"
          onLongPress={() => setDevTimingVisible(true)}
        >
          {dayLabel}
        </Pressable>
      ) : (
        dayLabel
      )}
      {handoffVisible && (
        <AppText variant="bodySoft" style={styles.handoffLine}>
          {strings.onboarding.handoff.line}
        </AppText>
      )}

      {step === "time" && (
        <View style={styles.question}>
          <AppText variant="title" style={styles.title}>
            {strings.prompt.time.question}
          </AppText>
          {MINUTES.map((m) => (
            <RowButton
              key={m}
              testID={`time-${m}`}
              label={strings.prompt.time.minutes[m]}
              onPress={() => {
                setMinutes(m);
                setStep("energy");
              }}
            />
          ))}
        </View>
      )}

      {step === "energy" && (
        <View style={styles.question}>
          <AppText variant="title" style={styles.title}>
            {strings.prompt.energy.question}
          </AppText>
          {ENERGY.map((e) => (
            <RowButton
              key={e}
              testID={`energy-${e}`}
              label={strings.prompt.energy.options[e]}
              onPress={() => {
                setEnergy(e);
                setStep("quiet");
              }}
            />
          ))}
        </View>
      )}

      {step === "quiet" && (
        <View style={styles.question}>
          <AppText variant="title" style={styles.title}>
            {strings.prompt.quiet.question}
          </AppText>
          <RowButton
            testID="quiet-yes"
            label={strings.prompt.quiet.yes}
            onPress={() => {
              setQuiet(true);
              setStep("soreness");
            }}
          />
          <RowButton
            testID="quiet-no"
            label={strings.prompt.quiet.no}
            onPress={() => {
              setQuiet(false);
              setStep("soreness");
            }}
          />
        </View>
      )}

      {step === "soreness" && (
        <ScrollView
          style={styles.question}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="title" style={styles.title}>
            {strings.prompt.soreness.question}
          </AppText>
          <RowButton
            testID="soreness-all-good"
            label={strings.prompt.soreness.allGood}
            onPress={() => finish([])}
          />
          {BODY_AREAS.map((area) => (
            <RowButton
              key={area}
              testID={`soreness-${area}`}
              label={strings.prompt.soreness.areas[area]}
              selected={avoid.includes(area)}
              onPress={() => toggleArea(area)}
            />
          ))}
          {avoid.length > 0 && (
            <View style={styles.confirm}>
              <PrimaryButton
                testID="soreness-confirm"
                label={strings.prompt.soreness.confirm}
                onPress={() => finish(avoid)}
              />
            </View>
          )}
        </ScrollView>
      )}

      {step === "error" && (
        <View style={styles.question}>
          <AppText variant="body" style={styles.title}>
            {strings.errors.sessionUnavailable}
          </AppText>
          <QuietButton
            testID="prompt-try-again"
            label={strings.errors.tryAgain}
            onPress={restart}
          />
        </View>
      )}

      {step === "noSession" && (
        <View style={styles.question}>
          <AppText variant="body" style={styles.title}>
            {strings.errors.noSession}
          </AppText>
          <QuietButton
            testID="prompt-adjust-answers"
            label={strings.errors.tryAgain}
            onPress={restart}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayLabel: {
    marginTop: spacing.md,
  },
  handoffLine: {
    marginTop: spacing.xs,
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
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
