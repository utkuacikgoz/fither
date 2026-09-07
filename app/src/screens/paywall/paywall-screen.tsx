import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { nextMilestone } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { LadderStrip } from "../../design/primitives/ladder-strip";
import { WORDMARK } from "../../design/primitives/wordmark";
import { useTheme } from "../../design/theme";
import { hairline, radius, spacing, trackingWide } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { getBilling, type PlanId } from "../../monetization/billing";
import { entitlementStatus } from "../../monetization/entitlement";
import { loadLibrary } from "../../session/load-library";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useProfileStore } from "../../state/profile-store";
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
  /** Optional chrome above the screen: the gated day's own eyebrow. */
  headerSlot?: ReactNode;
  /**
   * Rendered as the Today tab (the gated day, ADR-0009 §3): the record
   * note ("your record stays yours") is stated whatever the trial state,
   * because on that surface it is the boundary she needs to hear.
   */
  inDay?: boolean;
}

export function PaywallScreen({ headerSlot, inDay = false }: PaywallScreenProps = {}) {
  const purchasePlan = useEntitlementStore((s) => s.purchasePlan);
  const restorePurchases = useEntitlementStore((s) => s.restorePurchases);
  const resetForDev = useEntitlementStore((s) => s.resetForDev);
  const trialStartDate = useEntitlementStore((s) => s.trialStartDate);
  const trialUsed = useEntitlementStore((s) => s.trialUsed);
  const purchase = useEntitlementStore((s) => s.purchase);

  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const offerings = getBilling().getOfferings();
  const [selected, setSelected] = useState<PlanId>("annual");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>("none");

  // The expired gate state, from the same policy the launch gate uses.
  const expired =
    entitlementStatus({ firstCompletedDate: trialStartDate, purchase, trialUsed }) ===
    "trialExpired";
  // The selling screen (ADR-0017, owner-approved 2026-09-06): a promise
  // headline, one lead, the ladder she is on drawn as a picture, three
  // benefits, the plans. The expired day keeps its own headline and the
  // record note; everything else is the same honest image.
  const copy = expired
    ? {
        headline: strings.paywall.expired.headline,
        lead: strings.paywall.expired.recordNote,
        trialLine: strings.paywall.expired.trialLine,
        cta: strings.paywall.expired.cta,
      }
    : {
        headline: strings.paywall.headline,
        lead: strings.paywall.lead,
        trialLine: strings.paywall.trialLine,
        cta: strings.paywall.cta,
      };
  // The ladder is hers: the pattern the engine points her at next, with
  // the tiers she has reached in the green (nextMilestone decides).
  const profile = useProfileStore((s) => s.profile);
  const library = loadLibrary();
  const ladderPattern = nextMilestone(profile)?.pattern ?? "push";
  const reached = profile.patterns[ladderPattern].tier;

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
          <AppText
            variant={expired ? "title" : "display"}
            style={styles.headline}
            accessibilityRole="header"
          >
            {copy.headline}
          </AppText>
          <AppText variant="bodySoft" style={styles.lead}>
            {copy.lead}
          </AppText>
          {inDay && !expired && (
            <AppText variant="caption" style={styles.recordNote} testID="paywall-record-note">
              {strings.paywall.expired.recordNote}
            </AppText>
          )}
        </FadeIn>

        <View style={styles.ladder}>
          <LadderStrip
            testID="paywall-ladder"
            library={library}
            pattern={ladderPattern}
            reached={reached}
            reduceMotion={reduceMotion}
          />
        </View>

        <View style={styles.benefits} testID="paywall-benefits">
          {[
            strings.paywall.benefits.adapts,
            strings.paywall.benefits.anywhere,
            strings.paywall.benefits.simple,
          ].map((line) => (
            <View key={line} style={styles.benefit}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <AppText variant="body">{line}</AppText>
            </View>
          ))}
        </View>

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

        <AppText variant="caption" style={styles.trialLine}>
          {copy.trialLine}
        </AppText>
        <PrimaryButton
          testID="paywall-purchase"
          label={copy.cta}
          onPress={() => {
            void buy();
          }}
        />

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
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  letterhead: {
    letterSpacing: trackingWide,
    marginBottom: spacing.md,
  },
  headline: {
    marginBottom: spacing.sm,
  },
  lead: {
    marginBottom: spacing.lg,
  },
  recordNote: {
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  ladder: {
    marginBottom: spacing.lg,
  },
  benefits: {
    gap: spacing.sm + spacing.xs,
    marginBottom: spacing.lg,
  },
  benefit: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + spacing.xs,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.pill,
  },
  plans: {
    gap: spacing.sm + spacing.xs,
    marginBottom: spacing.md,
  },
  trialLine: {
    textAlign: "center",
    marginBottom: spacing.sm + spacing.xs,
  },
  restore: {
    marginTop: spacing.sm,
    alignItems: "center",
    gap: spacing.sm,
  },
  noticeText: {
    textAlign: "center",
  },
  rule: {
    borderTopWidth: hairline,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  legal: {
    textAlign: "center",
  },
  devReset: {
    marginTop: spacing.xl,
  },
});
