import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { WORDMARK } from "../../design/primitives/wordmark";
import { useTheme } from "../../design/theme";
import { hairline, spacing, trackingWide } from "../../design/tokens";
import { todayIso } from "../../lib/dates";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { getBilling, type PlanId } from "../../monetization/billing";
import { entitlementStatus } from "../../monetization/entitlement";
import { useEntitlementStore } from "../../state/entitlement-store";
import { PlanRow } from "./plan-row";

// The paywall as an honest letter (design-system): what's included and
// the price, plainly. Annual led (ADR-0002), monthly present, no
// countdowns, no strikethroughs, no scarcity. Purchase and restore go
// through the billing port; the screen never talks to a provider
// directly. Unlocking is store-driven — the launch surface re-renders
// into the daily prompt the moment the grant lands.
//
// The letter is typeset like one: a small letter-spaced wordmark as the
// letterhead (the share-card treatment — the display-size Wordmark
// primitive belongs to the launch brand moment, and would compete with
// the headline here), the letter body, one generous breath of space,
// then the choice. The non-interactive letter fades in gently (Reduce
// Motion honoured); plans and buttons are tappable from the first
// frame. A plan is always selected — annual by default — so the one
// button below the plans always has an honest referent, and its label
// names its outcome. A hairline rule separates her actions from the
// legal print, the way a letter ends.
//
// Two copy states, decided by the app-layer entitlement policy (never
// re-derived here): an expired trial gets the paywall.expired.* letter —
// no "free week ahead" promise she can no longer have — while every
// other state (pre-expiry, e.g. reached via future settings) keeps the
// pre-trial keys.

/**
 * After a purchase or restore attempt: nothing to say, or exactly one calm
 * notice — a failed purchase, a restore that found nothing, or a failed
 * restore. One slot, one register; starting a new attempt clears it.
 */
type Notice = "none" | "purchaseFailed" | "restoreEmpty" | "restoreFailed";

// Developer-facing only, shown solely in __DEV__ builds — deliberately
// not user-facing copy, so it does not live in strings.ts. Exported for
// the copy-audit test's allowlist.
export const DEV_RESET_LABEL = "[dev] Reset entitlement";

interface PaywallScreenProps {
  /**
   * Optional chrome above the letter. The gated day (audit P0 #7,
   * ADR-0009 §3) passes the daily surface's corner doors here so
   * Progress and Settings stay reachable while only new-session
   * generation is gated. The letter itself is unchanged either way.
   */
  headerSlot?: ReactNode;
}

export function PaywallScreen({ headerSlot }: PaywallScreenProps = {}) {
  const purchasePlan = useEntitlementStore((s) => s.purchasePlan);
  const restorePurchases = useEntitlementStore((s) => s.restorePurchases);
  const resetForDev = useEntitlementStore((s) => s.resetForDev);
  const trialStartDate = useEntitlementStore((s) => s.trialStartDate);
  const purchase = useEntitlementStore((s) => s.purchase);

  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const offerings = getBilling().getOfferings();
  const [selected, setSelected] = useState<PlanId>("annual");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>("none");

  // The expired gate state, from the same policy the launch gate uses.
  const expired =
    entitlementStatus({ trialStartDate, purchase, today: todayIso() }) ===
    "trialExpired";
  const copy = expired
    ? strings.paywall.expired
    : {
        headline: strings.paywall.headline,
        letter: strings.paywall.letter,
        trialLine: strings.paywall.trialLine,
        cta: strings.paywall.cta,
        afterTrialNote: strings.paywall.afterTrialNote,
      };

  const selectedOffering =
    offerings.find((o) => o.plan === selected) ?? offerings[0];

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    setNotice("none");
    // A false here is a provider/process failure (audit S2) — never her
    // declining. Say so calmly; success is store-driven (the grant lands
    // and the gate re-renders away), so there is nothing to say on true.
    const result = await purchasePlan(selected);
    // Closing the store sheet is her decision, not a failure — nothing
    // is said. Only a process failure gets the calm retry line.
    if (result === "failed") setNotice("purchaseFailed");
    setBusy(false);
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    setNotice("none");
    const result = await restorePurchases();
    if (result === "empty") setNotice("restoreEmpty");
    else if (result === "failed") setNotice("restoreFailed");
    setBusy(false);
  };

  return (
    <Screen>
      {headerSlot}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <FadeIn reduceMotion={reduceMotion}>
          <AppText variant="caption" style={styles.letterhead}>
            {WORDMARK}
          </AppText>
          <AppText variant="title" style={styles.headline}>
            {copy.headline}
          </AppText>
          <AppText variant="body" style={styles.letter}>
            {copy.letter}
          </AppText>
          <AppText variant="bodySoft" style={styles.trialLine}>
            {copy.trialLine}
          </AppText>
        </FadeIn>

        <View style={styles.plans}>
          {offerings.map((offering) => (
            <PlanRowFor
              key={offering.plan}
              plan={offering.plan}
              priceLabel={offering.priceLabel}
              noteLabel={offering.noteLabel}
              selected={selected === offering.plan}
              onSelect={() => setSelected(offering.plan)}
            />
          ))}
        </View>

        <PrimaryButton
          testID="paywall-purchase"
          label={copy.cta}
          onPress={() => {
            void buy();
          }}
        />
        {selectedOffering ? (
          <AppText variant="caption" style={styles.afterTrial}>
            {copy.afterTrialNote(selectedOffering.priceLabel)}
          </AppText>
        ) : null}

        <View style={styles.restore}>
          {/* The purchase notice sits above Restore, adjacent to the
              purchase cluster it answers (mapping), in the same register
              as the restore notices below. */}
          {notice === "purchaseFailed" && (
            <AppText
              variant="bodySoft"
              style={styles.noticeText}
              testID="paywall-purchase-error"
            >
              {strings.paywall.purchaseError}
            </AppText>
          )}
          <QuietButton
            testID="paywall-restore"
            label={strings.paywall.restore}
            onPress={() => {
              void restore();
            }}
          />
          {notice === "restoreFailed" && (
            <AppText
              variant="bodySoft"
              style={styles.noticeText}
              testID="paywall-restore-error"
            >
              {strings.paywall.restoreError}
            </AppText>
          )}
          {notice === "restoreEmpty" && (
            <AppText
              variant="bodySoft"
              style={styles.noticeText}
              testID="paywall-restore-empty"
            >
              {strings.paywall.restoreEmpty}
            </AppText>
          )}
        </View>

        <View style={[styles.rule, { borderTopColor: colors.line }]} />
        <AppText variant="caption" style={styles.legal}>
          {strings.paywall.legal.autoRenew}
        </AppText>
        {/* Terms / Privacy actions return here when the real legal-page
            URLs exist (launch checklist: privacy policy). Until then no
            control renders — a button that can't act is a constraints
            violation, not a placeholder (audit S3). The labels stay in
            strings.paywall.legal for that day. */}

        {__DEV__ && (
          // Dev-only control (ADR-0009): resets the app-side entitlement
          // so paywall flows can be re-tested. Never rendered in release.
          <View style={styles.devReset}>
            <QuietButton
              testID="paywall-dev-reset"
              label={DEV_RESET_LABEL}
              onPress={resetForDev}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

interface PlanRowForProps {
  plan: PlanId;
  priceLabel: string;
  noteLabel?: string | undefined;
  selected: boolean;
  onSelect: () => void;
}

function PlanRowFor({ plan, priceLabel, noteLabel, selected, onSelect }: PlanRowForProps) {
  return (
    <PlanRow
      testID={`paywall-plan-${plan}`}
      label={
        plan === "annual"
          ? strings.paywall.plans.annual.label
          : strings.paywall.plans.monthly.label
      }
      price={priceLabel}
      note={noteLabel}
      selected={selected}
      onPress={onSelect}
    />
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  letterhead: {
    textAlign: "center",
    letterSpacing: trackingWide,
    marginBottom: spacing.xl,
  },
  headline: {
    marginBottom: spacing.md,
  },
  letter: {
    marginBottom: spacing.md,
  },
  trialLine: {
    marginBottom: spacing.xxl,
  },
  plans: {
    marginBottom: spacing.sm,
  },
  afterTrial: {
    textAlign: "center",
    marginTop: spacing.md,
  },
  restore: {
    marginTop: spacing.xl,
    alignItems: "center",
    gap: spacing.xs,
  },
  noticeText: {
    textAlign: "center",
  },
  rule: {
    borderTopWidth: hairline,
    marginTop: spacing.xl,
  },
  legal: {
    marginTop: spacing.lg,
  },
  devReset: {
    marginTop: spacing.xl,
  },
});
