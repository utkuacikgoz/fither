import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { spacing } from "../../design/tokens";
import { todayIso } from "../../lib/dates";
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
// Two copy states, decided by the app-layer entitlement policy (never
// re-derived here): an expired trial gets the paywall.expired.* letter —
// no "free week ahead" promise she can no longer have — while every
// other state (pre-expiry, e.g. reached via future settings) keeps the
// pre-trial keys.

/** After a restore attempt: nothing to say, no purchase found, or failed. */
type RestoreNotice = "none" | "empty" | "failed";

// Developer-facing only, shown solely in __DEV__ builds — deliberately
// not user-facing copy, so it does not live in strings.ts. Exported for
// the copy-audit test's allowlist.
export const DEV_RESET_LABEL = "[dev] Reset entitlement";

export function PaywallScreen() {
  const purchasePlan = useEntitlementStore((s) => s.purchasePlan);
  const restorePurchases = useEntitlementStore((s) => s.restorePurchases);
  const resetForDev = useEntitlementStore((s) => s.resetForDev);
  const trialStartDate = useEntitlementStore((s) => s.trialStartDate);
  const purchase = useEntitlementStore((s) => s.purchase);

  const offerings = getBilling().getOfferings();
  const [selected, setSelected] = useState<PlanId>("annual");
  const [busy, setBusy] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState<RestoreNotice>("none");

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
    setRestoreNotice("none");
    await purchasePlan(selected);
    setBusy(false);
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    const result = await restorePurchases();
    setRestoreNotice(result === "restored" ? "none" : result);
    setBusy(false);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title" style={styles.headline}>
          {copy.headline}
        </AppText>
        <AppText variant="body" style={styles.letter}>
          {copy.letter}
        </AppText>
        <AppText variant="bodySoft" style={styles.trialLine}>
          {copy.trialLine}
        </AppText>

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
          <QuietButton
            testID="paywall-restore"
            label={strings.paywall.restore}
            onPress={() => {
              void restore();
            }}
          />
          {restoreNotice === "failed" && (
            <AppText
              variant="bodySoft"
              style={styles.restoreError}
              testID="paywall-restore-error"
            >
              {strings.paywall.restoreError}
            </AppText>
          )}
          {restoreNotice === "empty" && (
            <AppText
              variant="bodySoft"
              style={styles.restoreError}
              testID="paywall-restore-empty"
            >
              {strings.paywall.restoreEmpty}
            </AppText>
          )}
        </View>

        <AppText variant="caption" style={styles.legal}>
          {strings.paywall.legal.autoRenew}
        </AppText>
        <View style={styles.legalLinks}>
          {/* Placeholder labels: destinations land with the legal pages. */}
          <QuietButton
            testID="paywall-terms"
            label={strings.paywall.legal.termsLabel}
            onPress={() => undefined}
          />
          <QuietButton
            testID="paywall-privacy"
            label={strings.paywall.legal.privacyLabel}
            onPress={() => undefined}
          />
        </View>

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
  headline: {
    marginBottom: spacing.md,
  },
  letter: {
    marginBottom: spacing.md,
  },
  trialLine: {
    marginBottom: spacing.xl,
  },
  plans: {
    marginBottom: spacing.md,
  },
  afterTrial: {
    textAlign: "center",
    marginTop: spacing.sm,
  },
  restore: {
    marginTop: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  restoreError: {
    textAlign: "center",
  },
  legal: {
    marginTop: spacing.xl,
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  devReset: {
    marginTop: spacing.xl,
  },
});
