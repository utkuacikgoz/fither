import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type {
  BodyArea,
  DailyPrompt,
  Energy,
  SessionMinutes,
} from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { FlowProgress } from "../../design/primitives/flow-progress";
import { NoteField } from "../../design/primitives/note-field";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { motion, spacing } from "../../design/tokens";
import { BODY_AREAS } from "../../lib/body-areas";
import { needsCareMoment } from "../../lib/care-moment";
import { todayIso } from "../../lib/dates";
import { useReducedMotion } from "../../lib/use-reduced-motion";
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

/**
 * The four decided questions, in order (ADR-0003). The flow indicator
 * counts from this, so the product's structure is never re-typed as a
 * literal — and adding a fifth question would have to happen HERE,
 * where the domain rule against it is impossible to miss.
 */
const QUESTIONS: Step[] = ["time", "energy", "quiet", "soreness"];

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

/**
 * An answer row entering with its siblings. Short lists only — the three
 * option questions. The soreness list is eight rows and a stagger across
 * it becomes a wave travelling down the screen, which is the opposite of
 * "motion is breath"; that one fades as a single block.
 *
 * The row is hittable from the first frame, offset and all: a returning
 * user who knows the flow and taps ahead of the fade still lands on what
 * she sees, so nothing here spends Gate 3's budget.
 */
function AnswerRow({
  index,
  reduceMotion,
  children,
}: {
  index: number;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  return (
    <FadeIn
      reduceMotion={reduceMotion}
      delayMs={index * motion.staggerMs}
      rise={motion.riseDistance}
    >
      {children}
    </FadeIn>
  );
}

export function DailyPromptScreen({
  onSessionReady,
  showHandoff = false,
}: DailyPromptScreenProps) {
  const reduceMotion = useReducedMotion();
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

  // Whether today already holds completed work is the HUB's question now
  // (ADR-0013 §4): home renders the calm done state and owns "Another
  // session", from the one shared definition in state/today-training.ts.
  // Arriving here at all means she chose to build a session, so this
  // screen simply asks the four questions.

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
  // Words typed on a heavy day are never dropped by navigation (audit
  // polish): whatever is still in the field when this screen unmounts is
  // saved. restart() saves-and-clears first, so no double write.
  const careNoteRef = useRef(careNoteText);
  careNoteRef.current = careNoteText;
  useEffect(
    () => () => {
      const note = careNoteRef.current.trim();
      if (note.length > 0) {
        appendCareNote({ date: todayIso(), text: note });
      }
    },
    [appendCareNote],
  );

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

  // Leaving the can't-build state (audit S4a): back to the FIRST question
  // with today's answers kept as prefills — she adjusts what didn't work
  // instead of starting over. The optional care note (that state renders
  // the care moment) is saved on the way out, exactly as before: one
  // local, append-only save; it goes nowhere else.
  const adjustAnswers = () => {
    const note = careNoteText.trim();
    if (note.length > 0) {
      appendCareNote({ date: todayIso(), text: note });
    }
    setCareNoteText("");
    setStep("time");
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

  // Just the day label now. The corner doors are gone: Progress and
  // Settings are tabs on the hub (ADR-0013 §4), and this screen is a
  // pushed flow whose one job is the four questions — the way back is
  // the route's own back chevron.
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
    </View>
  );

  // Where she is in the four questions. Rendered only while a question
  // is on screen — the can't-build and error states are not steps of the
  // flow, and a bar that kept counting through them would lie.
  const questionIndex = QUESTIONS.indexOf(step);

  return (
    <Screen>
      {header}
      {handoffVisible && (
        <AppText variant="bodySoft" style={styles.handoffLine}>
          {strings.onboarding.handoff.line}
        </AppText>
      )}

      {questionIndex >= 0 && (
        <View style={styles.flow}>
          <FlowProgress
            testID="prompt-flow"
            total={QUESTIONS.length}
            current={questionIndex + 1}
            reduceMotion={reduceMotion}
          />
        </View>
      )}

      {step === "time" && (
        <FadeIn
          reduceMotion={reduceMotion}
          rise={motion.riseDistance}
          style={styles.question}
        >
          <AppText variant="title" style={styles.title}>
            {strings.prompt.time.question}
          </AppText>
          {MINUTES.map((m, index) => (
            <AnswerRow key={m} index={index} reduceMotion={reduceMotion}>
              <RowButton
                testID={`time-${m}`}
                label={strings.prompt.time.minutes[m]}
                selected={minutes === m}
                onPress={() => {
                  setMinutes(m);
                  setStep("energy");
                }}
              />
            </AnswerRow>
          ))}
        </FadeIn>
      )}

      {step === "energy" && (
        <FadeIn
          reduceMotion={reduceMotion}
          rise={motion.riseDistance}
          style={styles.question}
        >
          <AppText variant="title" style={styles.title}>
            {strings.prompt.energy.question}
          </AppText>
          {ENERGY.map((e, index) => (
            <AnswerRow key={e} index={index} reduceMotion={reduceMotion}>
              <RowButton
                testID={`energy-${e}`}
                label={strings.prompt.energy.options[e]}
                selected={energy === e}
                onPress={() => {
                  setEnergy(e);
                  setStep("quiet");
                }}
              />
            </AnswerRow>
          ))}
        </FadeIn>
      )}

      {step === "quiet" && (
        <FadeIn
          reduceMotion={reduceMotion}
          rise={motion.riseDistance}
          style={styles.question}
        >
          <AppText variant="title" style={styles.title}>
            {strings.prompt.quiet.question}
          </AppText>
          <AnswerRow index={0} reduceMotion={reduceMotion}>
            <RowButton
              testID="quiet-yes"
              label={strings.prompt.quiet.yes}
              selected={quiet === true}
              onPress={() => {
                setQuiet(true);
                setStep("soreness");
              }}
            />
          </AnswerRow>
          <AnswerRow index={1} reduceMotion={reduceMotion}>
            <RowButton
              testID="quiet-no"
              label={strings.prompt.quiet.no}
              selected={quiet === false}
              onPress={() => {
                setQuiet(false);
                setStep("soreness");
              }}
            />
          </AnswerRow>
        </FadeIn>
      )}

      {step === "soreness" && (
        <ScrollView
          style={styles.question}
          contentContainerStyle={styles.scrollContent}
          // Signifiers: seven areas plus the confirm run past the fold on
          // a small phone, and a hidden bar is the only cue missing.
          showsVerticalScrollIndicator
        >
          <FadeIn reduceMotion={reduceMotion} rise={motion.riseDistance}>
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
          </FadeIn>
        </ScrollView>
      )}

      {step === "error" && (
        <View style={styles.question}>
          <AppText variant="body" style={styles.title}>
            {strings.errors.sessionUnavailable}
          </AppText>
          {/* Audit S4b: "Try again" truthfully names a retry — the same
              answers go back through generation; nothing resets. */}
          <QuietButton
            testID="prompt-try-again"
            label={strings.errors.tryAgain}
            onPress={() => finish(avoid)}
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
              showsVerticalScrollIndicator
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
                label={strings.preview.changeAnswers}
                onPress={adjustAnswers}
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
  },
  dayLabel: {
    // Clears the transparent navigation header the /prompt route adds
    // (the back chevron lives up there), then breathes normally.
    marginTop: spacing.xxl,
  },
  handoffLine: {
    marginTop: spacing.xs,
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
});
