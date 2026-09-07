import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { Screen } from "../../design/primitives/screen";
import { SectionCaption } from "../../design/primitives/section-caption";
import { SettingsRow } from "../../design/primitives/settings-row";
import { spacing } from "../../design/tokens";
import { appVersion } from "../../lib/app-version";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { hasVoiceAudio } from "../../session/voice-manifest";
import { useCareNoteStore } from "../../state/care-note-store";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useReminderStore } from "../../state/reminder-store";
import { useSettingsStore } from "../../state/settings-store";
import { FirstMovementReadout } from "../dev-timing/first-movement-readout";
import { AccountSection } from "./account-section";
import { ProfileHeader } from "./profile-header";
import { RestoreNotice, useRestorePurchase } from "./restore-purchase";
import { DevToolsCard } from "./settings-dev-tools";
import { SettingsGroup } from "./settings-group";
import {
  avoidValue,
  equipmentValue,
  invitationValue,
  planValue,
  voiceValue,
} from "./settings-values";

// Settings as a grouped list (owner-approved 2026-09-06 round 6, mockup
// settings.html): the title, a profile header, then four groups with the
// eyebrow OUTSIDE the tile — Training, Daily invitation, Subscription,
// Account — each row stating its current value at the right and a
// chevron to the subpage where it is edited (app/settings/*). Two rows
// act in place instead: Restore purchase (its notice lands right under
// it) and Sign out; Erase everything opens its confirm inline. Dev tools
// close the list in __DEV__ builds, and the version footer stays.
//
// Every value is a read of what a store already holds, mapped to the
// copy-writer's words in settings-values.ts. No rule, threshold or
// derived value is decided on this screen.

// The dev tools live in settings-dev-tools.tsx (brief rule: a screen
// over 400 lines is split); their labels are re-exported here because
// the tests import them from the screen.
export { DEV_ENTITLEMENT_RESET_LABEL, DEV_PREVIEW_LABELS } from "./settings-dev-tools";

/** The subpage routes the chevrons open, one per editable row. */
export const SETTINGS_ROUTES = {
  avoid: "/settings/avoid",
  equipment: "/settings/equipment",
  voice: "/settings/voice",
  notes: "/settings/notes",
  invitation: "/settings/invitation",
  plan: "/settings/plan",
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
  const equipment = useSettingsStore((s) => s.equipment);
  const voice = useSettingsStore((s) => s.voice);
  const noteCount = useCareNoteStore((s) => s.entries.length);
  const reminderSlot = useReminderStore((s) => s.slot);
  const purchase = useEntitlementStore((s) => s.purchase);
  // Constraints: the voice row exists only when spoken cues are bundled
  // (the generator has run with the owner's voice); a switch for silence
  // would be a lie.
  const voiceRow = hasVoiceAudio();

  const reduceMotion = useReducedMotion();
  const { restore, notice } = useRestorePurchase();
  const [devTimingVisible, setDevTimingVisible] = useState(false);
  const version = appVersion();

  // The Gate 3 readout, same overlay pattern as the daily prompt's
  // long-press entry (which keeps working): state, not navigation.
  if (devToolsEnabled && devTimingVisible) {
    return <FirstMovementReadout onClose={() => setDevTimingVisible(false)} />;
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        // Signifiers: the owner could not tell a tab scrolled.
        showsVerticalScrollIndicator
      >
        <AppText variant="title" style={styles.title} accessibilityRole="header">
          {strings.settings.title}
        </AppText>

        <ProfileHeader />

        <View style={styles.section}>
          <SectionCaption label={strings.settings.sections.training} />
          <SettingsGroup order={0} reduceMotion={reduceMotion} testID="settings-training">
            <SettingsRow
              testID="settings-row-avoid"
              label={strings.settings.avoid.title}
              value={avoidValue(alwaysAvoid)}
              chevron
              onPress={() => router.push(SETTINGS_ROUTES.avoid)}
            />
            <SettingsRow
              testID="settings-row-equipment"
              label={strings.settings.rows.equipment}
              value={equipmentValue(equipment)}
              chevron
              onPress={() => router.push(SETTINGS_ROUTES.equipment)}
            />
            {voiceRow && (
              <SettingsRow
                testID="settings-row-voice"
                label={strings.settings.voice.title}
                value={voiceValue(voice)}
                chevron
                onPress={() => router.push(SETTINGS_ROUTES.voice)}
              />
            )}
            <SettingsRow
              testID="settings-row-notes"
              label={strings.settings.careNotes.title}
              value={strings.settings.rows.notesValue(noteCount)}
              chevron
              divider={false}
              onPress={() => router.push(SETTINGS_ROUTES.notes)}
            />
          </SettingsGroup>
        </View>

        <View style={styles.section}>
          <SectionCaption label={strings.settings.reminders.title} />
          <SettingsGroup order={1} reduceMotion={reduceMotion} testID="settings-invitation">
            <SettingsRow
              testID="settings-row-time"
              label={strings.settings.rows.time}
              value={invitationValue(reminderSlot)}
              chevron
              divider={false}
              onPress={() => router.push(SETTINGS_ROUTES.invitation)}
            />
          </SettingsGroup>
        </View>

        <View style={styles.section}>
          <SectionCaption label={strings.settings.restore.title} />
          <SettingsGroup order={2} reduceMotion={reduceMotion} testID="settings-subscription">
            <SettingsRow
              testID="settings-row-plan"
              label={strings.settings.rows.plan}
              value={planValue(purchase)}
              chevron
              onPress={() => router.push(SETTINGS_ROUTES.plan)}
            />
            {/* An action, not a door: no chevron, no value. */}
            <SettingsRow
              testID="settings-restore"
              label={strings.paywall.restore}
              divider={false}
              onPress={restore}
            />
            <RestoreNotice notice={notice} />
          </SettingsGroup>
        </View>

        <View style={styles.section}>
          <AccountSection order={3} reduceMotion={reduceMotion} />
        </View>

        {devToolsEnabled && (
          <DevToolsCard
            order={4}
            reduceMotion={reduceMotion}
            onOpenTiming={() => setDevTimingVisible(true)}
          />
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
    marginBottom: spacing.md + spacing.xs,
  },
  section: {
    marginBottom: spacing.lg + spacing.xs,
  },
  version: {
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
