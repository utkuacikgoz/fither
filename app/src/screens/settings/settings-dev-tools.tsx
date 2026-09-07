import { router } from "expo-router";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { Card } from "../../design/primitives/card";
import { QuietButton } from "../../design/primitives/quiet-button";
import { spacing } from "../../design/tokens";
import { useDevReceiptStore } from "../../monetization/dev-billing";
import { getMonitoring } from "../../monitoring/monitoring";
import {
  seedFinishPreviewForDev,
  seedFreeSessionsPreviewForDev,
  seedFreshEntitlementForDev,
  seedTrialActiveForDev,
  seedTrialExpiredForDev,
  seedUnlockPreviewForDev,
} from "../../state/dev-preview";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useLifetimeOfferStore } from "../../state/lifetime-offer-store";
import { DEV_TIMING_TITLE } from "../dev-timing/first-movement-readout";
import { StyleSheet } from "react-native";

// The Settings dev tools card — __DEV__ builds only (the screen decides
// whether it exists at all). Split out of settings-screen.tsx (brief
// rule: a screen over 400 lines is split); behaviour unchanged.
//
// Developer-facing only, deliberately not user-facing copy, so the
// labels do not live in strings.ts (same allowlist pattern as the
// paywall's DEV_RESET_LABEL). Exported for the copy-audit test's
// allowlist.
export const DEV_ENTITLEMENT_RESET_LABEL = "[dev] Reset entitlement";

// The dev flow-previewer's labels (same allowlist pattern). Each action
// seeds REAL store state (state/dev-preview.ts) and then navigates to
// the real route — the guards and gating decide what renders, never a
// faked screen.
export const DEV_PREVIEW_LABELS = {
  paywallExpired: "[dev] Preview paywall (expired)",
  paywallTrialActive: "[dev] Preview paywall (trial active)",
  entitlementFresh: "[dev] Reset entitlement (fresh)",
  freeSessionsControl: "[dev] Preview free sessions (control: 1 of 1 used)",
  freeSessionsThree: "[dev] Preview free sessions (three: 1 of 3 used)",
  unlock: "[dev] Preview unlock",
  finishCompleted: "[dev] Preview finish (complete)",
  finishEndedEarly: "[dev] Preview finish (ended early)",
  finishOutOfTime: "[dev] Preview finish (out of time)",
  finishNothingDone: "[dev] Preview finish (nothing done)",
  lifetimeOffer: "[dev] Preview lifetime offer (day-3 canceller)",
  testJsError: "[dev] Throw a test error (crash reporting)",
  testNativeCrash: "[dev] Crash natively (crash reporting)",
} as const;

interface DevToolsCardProps {
  order: number;
  reduceMotion: boolean;
  /** Open the Gate 3 timing readout (the screen owns that overlay). */
  onOpenTiming: () => void;
}

export function DevToolsCard({ order, reduceMotion, onOpenTiming }: DevToolsCardProps) {
  const resetEntitlementForDev = useEntitlementStore((s) => s.resetForDev);
  return (
      // retire to here).
      <Card order={order} reduceMotion={reduceMotion} testID="settings-dev">
        <AppText variant="caption" style={styles.sectionHeading}>
          {strings.settings.dev.title}
        </AppText>
        <QuietButton
          testID="settings-dev-timing"
          label={DEV_TIMING_TITLE}
          onPress={onOpenTiming}
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
        {/* ADR-0025: the free-sessions experiment from either side. The
            variant is forced through the store's dev override (the
            build's activation stays what it is); one qualifying session
            is seeded; "/" then gates (control) or keeps training (three). */}
        <QuietButton
          testID="settings-dev-free-sessions-control"
          label={DEV_PREVIEW_LABELS.freeSessionsControl}
          onPress={() => {
            seedFreeSessionsPreviewForDev("control");
            router.replace("/");
          }}
        />
        <QuietButton
          testID="settings-dev-free-sessions-three"
          label={DEV_PREVIEW_LABELS.freeSessionsThree}
          onPress={() => {
            seedFreeSessionsPreviewForDev("three");
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
        {/* ADR-0016 / launch checklist: the deliberate crash that proves
            reports and symbolication reach the owner before TestFlight.
            Both go through the port, so without a DSN they stay local. */}
        <QuietButton
          testID="settings-dev-test-js-error"
          label={DEV_PREVIEW_LABELS.testJsError}
          onPress={() => getMonitoring().testJsError()}
        />
        <QuietButton
          testID="settings-dev-test-native-crash"
          label={DEV_PREVIEW_LABELS.testNativeCrash}
          onPress={() => getMonitoring().testNativeCrash()}
        />
      </Card>
  );
}

const styles = StyleSheet.create({
  sectionHeading: {
    marginBottom: spacing.sm,
  },
});
