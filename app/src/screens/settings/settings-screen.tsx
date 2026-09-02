import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { QuietButton } from "../../design/primitives/quiet-button";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
import { appVersion } from "../../lib/app-version";
import { BODY_AREAS } from "../../lib/body-areas";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useSettingsStore } from "../../state/settings-store";
import {
  DEV_TIMING_TITLE,
  FirstMovementReadout,
} from "../dev-timing/first-movement-readout";

// The settings screen (ADR-0009 left restore + dev controls "until a
// settings screen exists" — this is it). Three quiet sections in a fixed
// order — persistent avoid areas, subscription restore, dev tools — and a
// version footer. The avoid list is preference data only: what "avoid"
// means to a session is decided entirely engine-side; this screen just
// edits the stored list the daily prompt merges into every day's input.

/** After a restore attempt: nothing to say, no purchase found, or failed. */
type RestoreNotice = "none" | "empty" | "failed";

// Developer-facing only, shown solely in __DEV__ builds — deliberately
// not user-facing copy, so it does not live in strings.ts (same allowlist
// pattern as the paywall's DEV_RESET_LABEL). Exported for the copy-audit
// test's allowlist.
export const DEV_ENTITLEMENT_RESET_LABEL = "[dev] Reset entitlement";

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
  const restorePurchases = useEntitlementStore((s) => s.restorePurchases);
  const resetEntitlementForDev = useEntitlementStore((s) => s.resetForDev);

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
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title" style={styles.title}>
          {strings.settings.title}
        </AppText>

        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionHeading}>
            {strings.settings.avoid.title}
          </AppText>
          <AppText variant="bodySoft" style={styles.sectionBody}>
            {strings.settings.avoid.body}
          </AppText>
          {BODY_AREAS.map((area) => (
            <RowButton
              key={area}
              testID={`avoid-${area}`}
              label={strings.prompt.soreness.areas[area]}
              selected={alwaysAvoid.includes(area)}
              multiSelect
              onPress={() => toggleAlwaysAvoid(area)}
            />
          ))}
        </View>

        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionHeading}>
            {strings.settings.restore.title}
          </AppText>
          <RowButton
            testID="settings-restore"
            label={strings.paywall.restore}
            onPress={() => {
              void restore();
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
        </View>

        {devToolsEnabled && (
          // Dev-only tools. The long-press entries elsewhere keep working;
          // these are the findable front doors (ADR-0009's interim homes
          // retire to here).
          <View style={styles.section}>
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
          </View>
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
    // Clears the transparent navigation header the settings route adds
    // (the back chevron lives up there), then breathes normally.
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
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
    marginTop: spacing.md,
  },
});
