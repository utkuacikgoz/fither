import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import type { BodyArea, DailyPrompt, Energy, SessionMinutes } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { NoteField } from "../../design/primitives/note-field";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
import { BODY_AREAS } from "../../lib/body-areas";
import { needsCareMoment } from "../../lib/care-moment";
import { todayIso } from "../../lib/dates";
import { useCareNoteStore } from "../../state/care-note-store";
import { useSessionStore } from "../../state/session-store";
import { useActiveSessionStore } from "../../state/active-session-store";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useIdentityStore } from "../../state/identity-store";
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
  const previousPrompt = useSessionStore((s) => s.prompt);
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
  // Identity belongs to the same hydration set: the launch surface gates
  // on it, so the prompt waiting on it too means a slow identity key can
  // never flash an interactive prompt that sign-in then yanks away, and a
  // corrupt one surfaces the same honest storage state as every other
  // store instead of silently disabling launch's gates.
  const identityHydrated = useIdentityStore((s) => s.hydrated);
  const identityFailed = useIdentityStore((s) => s.hydrationFailed);

  const appendCareNote = useCareNoteStore((s) => s.append);

  // Completed-today detection (audit wave 2): today's date has a history
  // entry — read from the profile store's engine-written record, never
  // re-derived. Training again is HER choice: "Another session" flips
  // this launch back to the normal four questions, nothing pushes her.
  const historyEntries = useProfileStore((s) => s.history.entries);
  const [anotherSession, setAnotherSession] = useState(false);

  const [step, setStep] = useState<Step>("time");
  const [devTimingVisible, setDevTimingVisible] = useState(false);
  const [minutes, setMinutes] = useState<SessionMinutes | null>(
    previousPrompt?.minutes ?? null,
  );
  const [energy, setEnergy] = useState<Energy | null>(
    previousPrompt?.energy ?? null,
  );
  const [quiet, setQuiet] = useState<boolean | null>(
    previousPrompt?.quiet ?? null,
  );
  const [avoid, setAvoid] = useState<BodyArea[]>(
    previousPrompt?.avoid.filter((area) => !alwaysAvoid.includes(area)) ?? [],
  );
  const [careNoteText, setCareNoteText] = useState("");

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
    // If she wrote in the optional care note, keep it before the answers
    // reset — one local, append-only save; it goes nowhere else.
    const note = careNoteText.trim();
    if (note.length > 0) {
      appendCareNote({ date: todayIso(), text: note });
    }
    setCareNoteText("");
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
    entitlementHydrated &&
    identityHydrated;
  const hydrationFailed =
    settingsFailed ||
    profileFailed ||
    ledgerFailed ||
    activeFailed ||
    entitlementFailed ||
    identityFailed;

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

  const header = (
    <View style={styles.header}>
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
      {/* The quiet corner doors to progress and settings — pushed
          routes, so her answers survive the round trip. Deliberately
          the smallest interactive things here: the day's one decision
          stays the screen's focal point. */}
      <View style={styles.headerActions}>
        <QuietButton
          testID="open-progress"
          label={strings.profile.title}
          onPress={() => router.push("/progress")}
        />
        <QuietButton
          testID="open-settings"
          label={strings.settings.title}
          onPress={() => router.push("/settings")}
        />
      </View>
    </View>
  );

  // The calm done-state: today already holds an applied session. States
  // what she did (minutes come straight off today's history entries) and
  // offers one quiet action — no reward framing, no urgency. Corner
  // doors stay; first runs never land here (no history yet), so the
  // handoff eyebrow and Gate 3 instrumentation are untouched.
  const today = todayIso();
  const todaysEntries = historyEntries.filter((entry) => entry.date === today);
  if (todaysEntries.length > 0 && !anotherSession) {
    const minutesToday = todaysEntries.reduce(
      (sum, entry) => sum + entry.minutes,
      0,
    );
    return (
      <Screen>
        {header}
        <View style={styles.doneState}>
          <AppText variant="title" accessibilityRole="header">
            {strings.prompt.completedToday.headline}
          </AppText>
          <AppText
            variant="bodySoft"
            style={styles.doneLine}
            testID="completed-today-line"
          >
            {strings.prompt.completedToday.line(minutesToday)}
          </AppText>
        </View>
        <View style={styles.doneAction}>
          <QuietButton
            testID="another-session"
            label={strings.prompt.completedToday.action}
            onPress={() => setAnotherSession(true)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
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
              selected={minutes === m}
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
              selected={energy === e}
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
            selected={quiet === true}
            onPress={() => {
              setQuiet(true);
              setStep("soreness");
            }}
          />
          <RowButton
            testID="quiet-no"
            label={strings.prompt.quiet.no}
            selected={quiet === false}
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
          {avoid.length === 0 && (
            <RowButton
              testID="soreness-all-good"
              label={strings.prompt.soreness.allGood}
              onPress={() => finish([])}
            />
          )}
          {BODY_AREAS.map((area) => (
            <RowButton
              key={area}
              testID={`soreness-${area}`}
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
                testID="soreness-count"
              >
                {strings.prompt.soreness.areasNoted(avoid.length)}
              </AppText>
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

      {step === "noSession" &&
        (() => {
          // The engine couldn't build around her selection — if body areas
          // were part of it, this is the "everything hurts" moment: lead
          // with care, never a dead end. Whether a session was possible
          // was decided engine-side; here we only read that result.
          const mergedAvoidCount = BODY_AREAS.filter(
            (area) => alwaysAvoid.includes(area) || avoid.includes(area),
          ).length;
          const care = needsCareMoment(mergedAvoidCount, false);
          return (
            <ScrollView
              style={styles.question}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {care && (
                <AppText
                  variant="title"
                  style={styles.careAcknowledgment}
                  testID="care-acknowledgment"
                >
                  {strings.care.acknowledgment}
                </AppText>
              )}
              <AppText variant="body" style={styles.title}>
                {strings.errors.noSession}
              </AppText>
              {care && (
                <View style={styles.careNote}>
                  <NoteField
                    testID="care-note"
                    prompt={strings.care.notePrompt}
                    privacyNote={strings.care.notePrivacy}
                    value={careNoteText}
                    onChangeText={setCareNoteText}
                  />
                </View>
              )}
              <QuietButton
                testID="prompt-adjust-answers"
                label={strings.errors.tryAgain}
                onPress={restart}
              />
            </ScrollView>
          );
        })()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayLabel: {
    marginTop: spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
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
  countCue: {
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  careAcknowledgment: {
    marginBottom: spacing.md,
  },
  careNote: {
    marginBottom: spacing.xl,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  doneState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  doneLine: {
    marginTop: spacing.sm,
    textAlign: "center",
  },
  doneAction: {
    paddingBottom: spacing.md,
  },
});
