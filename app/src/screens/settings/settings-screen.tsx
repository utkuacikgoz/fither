import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { Card } from "../../design/primitives/card";
import { OptionRow } from "../../design/primitives/option-row";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
import { appVersion } from "../../lib/app-version";
import { BODY_AREAS } from "../../lib/body-areas";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import {
  seedFinishPreviewForDev,
  seedFreshEntitlementForDev,
  seedTrialActiveForDev,
  seedTrialExpiredForDev,
  seedUnlockPreviewForDev,
} from "../../state/dev-preview";
import { useDevReceiptStore } from "../../monetization/dev-billing";
import { manageSubscription } from "../../monetization/manage-subscription";
import { REMINDER_SLOTS } from "../../notifications/notifications";
import { useLifetimeOfferStore } from "../../state/lifetime-offer-store";
import { hasVoiceAudio } from "../../session/voice-manifest";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useReminderStore } from "../../state/reminder-store";
import {
  FLOOR_ONLY_EQUIPMENT,
  useSettingsStore,
  WITH_CHAIR_EQUIPMENT,
} from "../../state/settings-store";
import {
  DEV_TIMING_TITLE,
  FirstMovementReadout,
} from "../dev-timing/first-movement-readout";
import { CareJournal } from "./care-journal";

// The settings screen (ADR-0009 left restore + dev controls "until a
// settings screen exists" — this is it). Quiet sections in a fixed
// order — persistent avoid areas, where she trains, subscription
// restore, the daily invitation, the care journal (ADR-0012 §4), dev
// tools — and a version footer.
//
// Each section is a Card (ADR-0013), the same card the hub and progress
// use, and its choices are OptionRows grouped inside it. The old shape
// stacked full-bordered RowButtons — the prompt's answer unit — straight
// onto the page, which turned a preferences screen into a wall of
// identical boxes with no grouping. Same choices, same store calls, same
// testIDs: only the grouping changed. The avoid list is
// preference data only: what "avoid" means to a session is decided
// entirely engine-side; this screen just edits the stored list the daily
// prompt merges into every day's input.

/** After a restore attempt: nothing to say, no purchase found, or failed. */
type RestoreNotice = "none" | "empty" | "failed";

// Developer-facing only, shown solely in __DEV__ builds — deliberately
// not user-facing copy, so it does not live in strings.ts (same allowlist
// pattern as the paywall's DEV_RESET_LABEL). Exported for the copy-audit
// test's allowlist.
export const DEV_ENTITLEMENT_RESET_LABEL = "[dev] Reset entitlement";

// The dev flow-previewer's labels (same allowlist pattern). Each action
// seeds REAL store state (state/dev-preview.ts) and then navigates to
// the real route — the guards and gating decide what renders, never a
// faked screen.
export const DEV_PREVIEW_LABELS = {
  paywallExpired: "[dev] Preview paywall (expired)",
  paywallTrialActive: "[dev] Preview paywall (trial active)",
  entitlementFresh: "[dev] Reset entitlement (fresh)",
  unlock: "[dev] Preview unlock",
  finishCompleted: "[dev] Preview finish (complete)",
  finishEndedEarly: "[dev] Preview finish (ended early)",
  finishOutOfTime: "[dev] Preview finish (out of time)",
  finishNothingDone: "[dev] Preview finish (nothing done)",
  lifetimeOffer: "[dev] Preview lifetime offer (day-3 canceller)",
} as const;

interface SettingsScreenProps {
  /**
   * Whether the dev-tools section exists at all (constraints: what can't
   * apply is not rendered). Defaults to the build flag; a prop so tests
   * can also cover the release shape, where jest's __DEV__ is stuck true.
   */
  devToolsEnabled?: boolean;
}

export function SettingsScreen({
  devToolsEnabled = __DEV__,
}: SettingsScreenProps) {
  const alwaysAvoid = useSettingsStore((s) => s.alwaysAvoid);
  const toggleAlwaysAvoid = useSettingsStore((s) => s.toggleAlwaysAvoid);
  const equipment = useSettingsStore((s) => s.equipment);
  const setEquipment = useSettingsStore((s) => s.setEquipment);
  const restorePurchases = useEntitlementStore((s) => s.restorePurchases);
  const resetEntitlementForDev = useEntitlementStore((s) => s.resetForDev);
  const reminderSlot = useReminderStore((s) => s.slot);
  const chooseSlotWithPermission = useReminderStore(
    (s) => s.chooseSlotWithPermission,
  );
  const disableReminders = useReminderStore((s) => s.disable);
  const reminderDenied = useReminderStore((s) => s.permissionDenied);
  // The stagger counts VISIBLE cards: an absent voice card must not
  // leave the journal waiting for a beat that nothing fills.
  const voiceCard = hasVoiceAudio();
  const voice = useSettingsStore((s) => s.voice);
  const setVoice = useSettingsStore((s) => s.setVoice);

  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState<RestoreNotice>("none");
  const [devTimingVisible, setDevTimingVisible] = useState(false);

  const version = appVersion();

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    // Same handling as the paywall's restore (which stays there too —
    // Apple wants restore near the purchase): "restored" needs no notice,
    // the entitlement store simply holds the grant again.
    const result = await restorePurchases();
    setRestoreNotice(result === "restored" ? "none" : result);
    setBusy(false);
  };

  // The Gate 3 readout, same overlay pattern as the daily prompt's
  // long-press entry (which keeps working): state, not navigation.
  if (devToolsEnabled && devTimingVisible) {
    return <FirstMovementReadout onClose={() => setDevTimingVisible(false)} />;
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        // Signifiers: the owner could not tell a tab scrolled, and this
        // is the longest screen in the app.
        showsVerticalScrollIndicator
      >
        <AppText
          variant="title"
          style={styles.title}
          accessibilityRole="header"
        >
          {strings.settings.title}
        </AppText>

        <Card order={0} reduceMotion={reduceMotion} testID="settings-avoid">
          <AppText variant="caption" style={styles.sectionHeading}>
            {strings.settings.avoid.title}
          </AppText>
          <AppText variant="bodySoft" style={styles.sectionBody}>
            {strings.settings.avoid.body}
          </AppText>
          {BODY_AREAS.map((area, index) => (
            <OptionRow
              key={area}
              testID={`avoid-${area}`}
              label={strings.prompt.soreness.areas[area]}
              selected={alwaysAvoid.includes(area)}
              divider={index < BODY_AREAS.length - 1}
              onPress={() => toggleAlwaysAvoid(area)}
            />
          ))}
        </Card>

        {/* Audit S6: the onboarding floor/chair answer was a one-shot —
            editable here now. Same two options, same strings, same
            equipment sets (a wall exists in every room she'd train in,
            so it stays on both paths — the engine rule is never
            re-derived, these are onboarding's own constants mirrored
            through the store). */}
        <Card order={1} reduceMotion={reduceMotion} testID="settings-equipment">
          <AppText variant="caption" style={styles.sectionHeading}>
            {strings.onboarding.equipment.question}
          </AppText>
          <OptionRow
            testID="equipment-floor-only"
            label={strings.onboarding.equipment.options.floorOnly}
            selected={!equipment.includes("chair")}
            onPress={() => setEquipment(FLOOR_ONLY_EQUIPMENT)}
          />
          <OptionRow
            testID="equipment-chair"
            label={strings.onboarding.equipment.options.chair}
            selected={equipment.includes("chair")}
            divider={false}
            onPress={() => setEquipment(WITH_CHAIR_EQUIPMENT)}
          />
        </Card>

        <Card order={2} reduceMotion={reduceMotion} testID="settings-subscription">
          <AppText variant="caption" style={styles.sectionHeading}>
            {strings.settings.restore.title}
          </AppText>
          {/* An action, not a choice: no selectable state to carry, so
              the accent label is what says "tappable" (affordance). */}
          <OptionRow
            testID="settings-restore"
            label={strings.paywall.restore}
            emphasis="action"
            onPress={() => {
              void restore();
            }}
          />
          {/* Change plan, cancel, refund — Apple's own flows through the
              store's Customer Center, or Apple's subscriptions page
              without the key (ADR-0014). Never a dead end. */}
          <OptionRow
            testID="settings-manage-subscription"
            label={strings.settings.restore.manage}
            emphasis="action"
            divider={false}
            onPress={() => {
              void manageSubscription();
            }}
          />
          {restoreNotice === "failed" && (
            <AppText
              variant="bodySoft"
              style={styles.restoreNotice}
              testID="settings-restore-error"
            >
              {strings.paywall.restoreError}
            </AppText>
          )}
          {restoreNotice === "empty" && (
            <AppText
              variant="bodySoft"
              style={styles.restoreNotice}
              testID="settings-restore-empty"
            >
              {strings.paywall.restoreEmpty}
            </AppText>
          )}
        </Card>

        {/* The daily invitation (launch-checklist rules): three slots +
            "No invitation", all equal-dignity rows, current state
            selected. Selection state is per-option, on the option
            (mapping). If the OS permission was never granted and she
            picks a slot HERE, the store requests it right then — she is
            literally asking for the notification, which is the most
            in-context a permission ask gets. On an OS denial nothing
            schedules and "No invitation" honestly stays selected — the
            OS dialog she just answered is the feedback. */}
        <Card order={3} reduceMotion={reduceMotion} testID="settings-reminders">
          <AppText variant="caption" style={styles.sectionHeading}>
            {strings.settings.reminders.title}
          </AppText>
          {REMINDER_SLOTS.map((slot) => (
            <OptionRow
              key={slot}
              testID={`reminder-${slot}`}
              label={strings.notifications.time[slot]}
              selected={reminderSlot === slot}
              onPress={() => {
                void chooseSlotWithPermission(slot);
              }}
            />
          ))}
          <OptionRow
            testID="reminder-off"
            label={strings.settings.reminders.off}
            selected={reminderSlot === null}
            divider={false}
            onPress={() => {
              void disableReminders();
            }}
          />
          {/* A hard OS denial answers her tap with nothing at all — the
              dialog no longer appears (wave-C flag, now closed). The one
              line that names where the switch actually is, in the card
              whose rows it explains (mapping), only while it is true. */}
          {reminderDenied && (
            <AppText
              variant="bodySoft"
              style={styles.restoreNotice}
              testID="reminder-denied"
            >
              {strings.settings.reminders.denied}
            </AppText>
          )}
        </Card>

        {/* Constraints: what can't apply is not rendered. The card exists
            only when spoken cues are bundled (the generator has run with
            the owner's voice); a switch for silence would be a lie. */}
        {voiceCard && (
          <Card order={4} reduceMotion={reduceMotion} testID="settings-voice">
            <AppText variant="caption" style={styles.sectionHeading}>
              {strings.settings.voice.title}
            </AppText>
            <AppText variant="bodySoft" style={styles.sectionBody}>
              {strings.settings.voice.body}
            </AppText>
            <OptionRow
              testID="voice-on"
              label={strings.settings.voice.on}
              selected={voice}
              onPress={() => setVoice(true)}
            />
            <OptionRow
              testID="voice-off"
              label={strings.settings.voice.off}
              selected={!voice}
              divider={false}
              onPress={() => setVoice(false)}
            />
          </Card>
        )}

        <Card order={voiceCard ? 5 : 4} reduceMotion={reduceMotion} testID="settings-journal">
          <CareJournal />
        </Card>

        {devToolsEnabled && (
          // Dev-only tools. The long-press entries elsewhere keep working;
          // these are the findable front doors (ADR-0009's interim homes
          // retire to here).
          <Card order={voiceCard ? 6 : 5} reduceMotion={reduceMotion} testID="settings-dev">
            <AppText variant="caption" style={styles.sectionHeading}>
              {strings.settings.dev.title}
            </AppText>
            <QuietButton
              testID="settings-dev-timing"
              label={DEV_TIMING_TITLE}
              onPress={() => setDevTimingVisible(true)}
            />
            <QuietButton
              testID="settings-dev-reset"
              label={DEV_ENTITLEMENT_RESET_LABEL}
              onPress={resetEntitlementForDev}
            />
            {/* The flow previewer: seed real state, go to the real route.
                "/" re-renders the launch surface's honest gating over the
                seeded entitlement; /unlock and /finish pass their guards
                because the seeded finish summary is valid state. */}
            <QuietButton
              testID="settings-dev-paywall-expired"
              label={DEV_PREVIEW_LABELS.paywallExpired}
              onPress={() => {
                seedTrialExpiredForDev();
                router.replace("/");
              }}
            />
            <QuietButton
              testID="settings-dev-paywall-trial-active"
              label={DEV_PREVIEW_LABELS.paywallTrialActive}
              onPress={() => {
                seedTrialActiveForDev();
                router.replace("/");
              }}
            />
            <QuietButton
              testID="settings-dev-entitlement-fresh"
              label={DEV_PREVIEW_LABELS.entitlementFresh}
              onPress={() => {
                seedFreshEntitlementForDev();
                router.replace("/");
              }}
            />
            <QuietButton
              testID="settings-dev-preview-unlock"
              label={DEV_PREVIEW_LABELS.unlock}
              onPress={() => {
                seedUnlockPreviewForDev();
                router.push("/unlock");
              }}
            />
            <QuietButton
              testID="settings-dev-finish-completed"
              label={DEV_PREVIEW_LABELS.finishCompleted}
              onPress={() => {
                seedFinishPreviewForDev("completed");
                router.push("/finish");
              }}
            />
            <QuietButton
              testID="settings-dev-finish-ended-early"
              label={DEV_PREVIEW_LABELS.finishEndedEarly}
              onPress={() => {
                seedFinishPreviewForDev("endedEarly");
                router.push("/finish");
              }}
            />
            <QuietButton
              testID="settings-dev-finish-out-of-time"
              label={DEV_PREVIEW_LABELS.finishOutOfTime}
              onPress={() => {
                seedFinishPreviewForDev("outOfTime");
                router.push("/finish");
              }}
            />
            {/* ADR-0014: simulate the store fact (trial cancelled, day 3)
                in the dev adapter, forget the one ask, and open the offer
                through the hub's own trigger. */}
            <QuietButton
              testID="settings-dev-lifetime-offer"
              label={DEV_PREVIEW_LABELS.lifetimeOffer}
              onPress={() => {
                useDevReceiptStore.getState().setTrialCancelled(true);
                useLifetimeOfferStore.getState().resetForDev();
                router.replace("/home");
              }}
            />
            <QuietButton
              testID="settings-dev-finish-nothing-done"
              label={DEV_PREVIEW_LABELS.finishNothingDone}
              onPress={() => {
                seedFinishPreviewForDev("nothingDone");
                router.push("/finish");
              }}
            />
          </Card>
        )}

        {version !== null && (
          <AppText variant="caption" style={styles.version}>
            {strings.settings.version(version)}
          </AppText>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    // A tab, not a pushed route (ADR-0013 §4): no header to clear, so
    // the title starts just below the safe area and breathes normally.
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.lg,
  },
  sectionHeading: {
    marginBottom: spacing.sm,
  },
  sectionBody: {
    marginBottom: spacing.md,
  },
  restoreNotice: {
    marginTop: spacing.sm,
  },
  version: {
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
