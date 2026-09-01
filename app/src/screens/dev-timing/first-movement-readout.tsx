import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { AppText } from "../../design/primitives/app-text";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
import { todayIso } from "../../lib/dates";
import {
  formatDeltaSeconds,
  latestFirstRun,
  type FirstMovementRun,
} from "../../lib/first-movement-timer";
import { wipeAllPersistedStateForDev } from "../../state/dev-reset";
import { useFirstMovementStore } from "../../state/first-movement-store";

// The Gate 3 readout: recorded open-to-first-movement runs, first-run
// delta prominently. __DEV__ only, entered by a long-press on the daily
// prompt's day label (see daily-prompt-screen.tsx) — never part of the
// real flow, never rendered in release.

// Developer-facing only, shown solely in __DEV__ builds — deliberately
// not user-facing copy, so it does not live in strings.ts (same allowlist
// pattern as the paywall's DEV_RESET_LABEL). Exported for the copy-audit
// test's allowlist.
export const DEV_TIMING_TITLE = "[dev] First movement timing";
export const DEV_TIMING_FIRST_RUN_CAPTION = "[dev] first-run open-to-movement";
export const DEV_TIMING_NO_FIRST_RUN = "[dev] no first-run capture yet";
export const DEV_TIMING_EMPTY = "[dev] no launches recorded yet";
export const DEV_TIMING_RESET_LABEL = "[dev] Reset timing runs";
export const DEV_TIMING_CLOSE_LABEL = "[dev] Close";

// Gate 3 tester handover (see state/dev-reset.ts): wipes EVERY persisted
// key so the next tester's launch is a true first run. Two taps by
// design — arming, then confirming — so it cannot fire accidentally.
export const DEV_FIRST_RUN_RESET_CAPTION =
  "[dev] Tester handover — wipes ALL persisted app state";
export const DEV_FIRST_RUN_RESET_LABEL = "[dev] Reset first-run state";
export const DEV_FIRST_RUN_RESET_CONFIRM_LABEL =
  "[dev] Confirm: wipe everything";
export const DEV_FIRST_RUN_RESET_DONE =
  "[dev] Wiped. Kill the app now and relaunch — the next open is a true first run.";

/** One line per recorded launch, newest shown first by the list below. */
export function devRunLine(run: FirstMovementRun): string {
  const label = run.firstRun ? "first run" : "later launch";
  return `[dev] ${todayIso(new Date(run.t0))} · ${formatDeltaSeconds(run.deltaMs)} · ${label}`;
}

interface FirstMovementReadoutProps {
  onClose: () => void;
}

export function FirstMovementReadout({ onClose }: FirstMovementReadoutProps) {
  const runs = useFirstMovementStore((s) => s.runs);
  const resetForDev = useFirstMovementStore((s) => s.resetForDev);
  const [wipePhase, setWipePhase] = useState<"idle" | "armed" | "done">("idle");

  if (!__DEV__) return null;

  const firstRun = latestFirstRun(runs);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title" style={styles.title}>
          {DEV_TIMING_TITLE}
        </AppText>

        <AppText variant="caption">{DEV_TIMING_FIRST_RUN_CAPTION}</AppText>
        {firstRun ? (
          <AppText variant="numeral" testID="dev-timing-first-run">
            {formatDeltaSeconds(firstRun.deltaMs)}
          </AppText>
        ) : (
          <AppText variant="bodySoft" testID="dev-timing-first-run-missing">
            {DEV_TIMING_NO_FIRST_RUN}
          </AppText>
        )}

        <View style={styles.list}>
          {runs.length === 0 ? (
            <AppText variant="bodySoft">{DEV_TIMING_EMPTY}</AppText>
          ) : (
            [...runs].reverse().map((run, index) => (
              <AppText
                key={`${run.t0}-${run.t1}-${index}`}
                variant="bodySoft"
                testID="dev-timing-run"
              >
                {devRunLine(run)}
              </AppText>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <QuietButton
            testID="dev-timing-reset"
            label={DEV_TIMING_RESET_LABEL}
            onPress={resetForDev}
          />
          <QuietButton
            testID="dev-timing-close"
            label={DEV_TIMING_CLOSE_LABEL}
            onPress={onClose}
          />
        </View>

        {/* Clearly separated from the timing-only reset above: the full
            Gate 3 tester handover. First tap arms, second tap wipes; the
            done line tells the tester to kill and relaunch (disk is
            wiped, this process's in-memory state deliberately is not —
            see state/dev-reset.ts). */}
        <View style={styles.fullReset}>
          <AppText variant="caption">{DEV_FIRST_RUN_RESET_CAPTION}</AppText>
          {wipePhase === "done" ? (
            <AppText variant="bodySoft" testID="dev-first-run-reset-done">
              {DEV_FIRST_RUN_RESET_DONE}
            </AppText>
          ) : (
            <>
              <QuietButton
                testID="dev-first-run-reset"
                label={DEV_FIRST_RUN_RESET_LABEL}
                onPress={() =>
                  setWipePhase((phase) => (phase === "idle" ? "armed" : "idle"))
                }
              />
              {wipePhase === "armed" && (
                <QuietButton
                  testID="dev-first-run-reset-confirm"
                  label={DEV_FIRST_RUN_RESET_CONFIRM_LABEL}
                  onPress={() => {
                    void wipeAllPersistedStateForDev().then(() =>
                      setWipePhase("done"),
                    );
                  }}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.xl,
  },
  list: {
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  fullReset: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});
