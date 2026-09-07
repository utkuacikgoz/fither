import { StyleSheet } from "react-native";

import { strings } from "../../../copy/strings";
import { AppText } from "../../../design/primitives/app-text";
import { OptionRow } from "../../../design/primitives/option-row";
import { spacing } from "../../../design/tokens";
import { useReducedMotion } from "../../../lib/use-reduced-motion";
import { REMINDER_SLOTS } from "../../../notifications/notifications";
import { useReminderStore } from "../../../state/reminder-store";
import { SettingsGroup } from "../settings-group";
import { SettingsSubpage } from "./settings-subpage";

// The daily invitation (mockup settings-time; launch-checklist rules):
// three slots plus "No invitation", all equal-dignity rows, the current
// state selected on the option itself (mapping). If the OS permission was
// never granted and she picks a slot HERE, the store requests it right
// then — she is literally asking for the notification, the most
// in-context a permission ask gets. On a hard OS denial nothing
// schedules, "No invitation" honestly stays selected, and the one line
// naming where the switch actually is renders under the rows it explains
// — only while that is true.

export function InvitationPage() {
  const reduceMotion = useReducedMotion();
  const slot = useReminderStore((s) => s.slot);
  const chooseSlotWithPermission = useReminderStore((s) => s.chooseSlotWithPermission);
  const disable = useReminderStore((s) => s.disable);
  const denied = useReminderStore((s) => s.permissionDenied);
  return (
    <SettingsSubpage
      title={strings.settings.reminders.title}
      lead={strings.notifications.rationale.line}
      testID="settings-invitation-page"
    >
      <SettingsGroup reduceMotion={reduceMotion} testID="settings-reminders">
        {REMINDER_SLOTS.map((candidate) => (
          <OptionRow
            key={candidate}
            testID={`reminder-${candidate}`}
            label={strings.notifications.time[candidate]}
            selected={slot === candidate}
            onPress={() => {
              void chooseSlotWithPermission(candidate);
            }}
          />
        ))}
        <OptionRow
          testID="reminder-off"
          label={strings.settings.reminders.off}
          selected={slot === null}
          divider={false}
          onPress={() => {
            void disable();
          }}
        />
        {denied && (
          <AppText variant="bodySoft" style={styles.denied} testID="reminder-denied">
            {strings.settings.reminders.denied}
          </AppText>
        )}
      </SettingsGroup>
    </SettingsSubpage>
  );
}

const styles = StyleSheet.create({
  denied: {
    paddingVertical: spacing.md,
  },
});
