import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { nextMilestone } from "@fither/engine";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { LadderStrip } from "../../design/primitives/ladder-strip";
import { useTheme } from "../../design/theme";
import { hairline, radius, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { openLegalPage } from "../../lib/legal-links";
import { getBilling, type PlanId } from "../../monetization/billing";
import { entitlementStatus } from "../../monetization/entitlement";
import { useFreeSessionsAllowance } from "../../monetization/experiment";
import { loadLibrary } from "../../session/load-library";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useIntentionStore } from "../../state/intention-store";
import { useProfileStore } from "../../state/profile-store";
import { PlanRow } from "./plan-row";
import { PaywallActions } from "./paywall-actions";

// One promise, the real capability ladder, two localised plans and a fixed
// action footer. Billing stays behind its port; store grants drive access.
// Expired trials retain the existing paid-access copy, never a new free week.
// ADR-0029 keeps the selected price beside the action and makes pending work
// explicit. Entrances and presses honour the screen's reduced-motion value.

/** One outcome notice; starting another attempt clears it. */
type Notice = "none" | "purchaseFailed" | "restoreEmpty" | "restoreFailed";

// Developer-facing only, shown solely in __DEV__ builds — deliberately
// not user-facing copy, so it does not live in strings.ts. Exported for
// the copy-audit test's allowlist.
export const DEV_RESET_LABEL = "[dev] Reset entitlement";

interface PaywallScreenProps {
  headerSlot?: ReactNode;
  /** The daily gate states that her records remain accessible. */
  inDay?: boolean;
  /** Optional offer after the first qualifying session and weekly choice. */
  firstClose?: boolean;
  onLeave?: () => void;
  onEntitled?: () => void;
}

export function PaywallScreen({
  headerSlot,
  inDay = false,
  firstClose = false,
  onLeave,
  onEntitled,
}: PaywallScreenProps = {}) {
  const purchasePlan = useEntitlementStore((s) => s.purchasePlan);
  const restorePurchases = useEntitlementStore((s) => s.restorePurchases);
  const resetForDev = useEntitlementStore((s) => s.resetForDev);
  const trialStartDate = useEntitlementStore((s) => s.trialStartDate);
  const trialUsed = useEntitlementStore((s) => s.trialUsed);
  const qualifyingSessions = useEntitlementStore((s) => s.qualifyingSessions);
  const freeSessions = useFreeSessionsAllowance();
  const purchase = useEntitlementStore((s) => s.purchase);
  const intention = useIntentionStore((s) => s.target);

  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const offerings = getBilling().getOfferings();
  const [selected, setSelected] = useState<PlanId>("annual");
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"purchase" | "restore">("purchase");
  const [notice, setNotice] = useState<Notice>("none");
  const selectedPrice = offerings.find((offering) => offering.plan === selected)?.priceLabel ?? "";

  // The expired gate state, from the same policy the launch gate uses.
  const expired =
    entitlementStatus({
      firstCompletedDate: trialStartDate,
      purchase,
      trialUsed,
      qualifyingSessions,
      freeSessions,
    }) === "trialExpired";
  // One observed view per surface (ADR-0024).
  const surface = expired
    ? "expired"
    : firstClose
      ? "firstClose"
      : inDay
        ? "gate"
        : "settings";
  useEffect(() => {
    track("paywall_view", { surface });
  }, [surface]);
  // Preserve distinct expired and first-session promises.
  // Only the first close carries a lead: it names the rhythm she chose.
  // Everywhere else the headline, the ladder and the price say it all
  // (copy cut 2026-09-14, owner).
  const copy: { headline: string; lead?: string; trialLine: string; cta: string } = expired
    ? {
        headline: strings.paywall.expired.headline,
        trialLine: strings.paywall.expired.trialLine,
        cta: strings.paywall.expired.cta,
      }
    : firstClose
      ? {
          headline: strings.paywall.firstClose.headline,
          lead: strings.paywall.firstClose.lead(intention),
          trialLine: strings.paywall.trialLine,
          cta: strings.paywall.cta,
        }
      : {
          headline: strings.paywall.headline,
          trialLine: strings.paywall.trialLine,
          cta: strings.paywall.cta,
        };
  // The engine supplies the milestone and tier.
  const profile = useProfileStore((s) => s.profile);
  const library = loadLibrary();
  const ladderPattern = nextMilestone(profile)?.pattern ?? "push";
  const reached = profile.patterns[ladderPattern].tier;

  const buy = async () => {
    if (busy) return;
    setBusyAction("purchase");
    setBusy(true);
    setNotice("none");
    const result = await purchasePlan(selected);
    // Closing the store sheet is her decision, not a failure — nothing
    // is said. Only a process failure gets the calm retry line.
    if (result === "failed") setNotice("purchaseFailed");
    setBusy(false);
    if (result === "purchased") onEntitled?.();
  };

  const restore = async () => {
    if (busy) return;
    setBusyAction("restore");
    setBusy(true);
    setNotice("none");
    const result = await restorePurchases();
    if (result === "empty") setNotice("restoreEmpty");
    else if (result === "failed") setNotice("restoreFailed");
    setBusy(false);
    if (result === "restored") onEntitled?.();
  };

  return (
    <Screen>
      {headerSlot}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <FadeIn reduceMotion={reduceMotion}>
          <AppText
            variant={expired ? "title" : "display"}
            style={styles.headline}
            accessibilityRole="header"
          >
            {copy.headline}
          </AppText>
          {copy.lead !== undefined && (
            <AppText variant="bodySoft" style={styles.lead}>
              {copy.lead}
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
              <AppText variant="body" style={styles.benefitText}>{line}</AppText>
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
              reduceMotion={reduceMotion}
              disabled={busy}
              onSelect={() => {
                setSelected(offering.plan);
                // paywall_plan: a row was tapped. The port never lists
                // lifetime here (ADR-0014); the narrow is for the types.
                if (offering.plan !== "lifetime") {
                  track("paywall_plan", { plan: offering.plan });
                }
              }}
            />
          ))}
        </View>

        <AppText variant="caption" style={styles.trialLine}>
          {copy.trialLine}
        </AppText>

        <View style={styles.restore}>
          <QuietButton
            testID="paywall-restore"
            disabled={busy}
            reduceMotion={reduceMotion}
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
        <View style={styles.legalActions}>
          <QuietButton
            testID="paywall-terms"
            label={strings.paywall.legal.termsLabel}
            onPress={() => void openLegalPage("terms")}
          />
          <QuietButton
            testID="paywall-privacy"
            label={strings.paywall.legal.privacyLabel}
            onPress={() => void openLegalPage("privacy")}
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
      <PaywallActions
        reduceMotion={reduceMotion}
        disclosure={expired ? strings.paywall.expired.afterTrialNote(selectedPrice) : strings.paywall.afterTrialNote(selectedPrice)}
        label={busy ? busyAction === "purchase" ? strings.paywall.purchasing : strings.paywall.restoring : copy.cta}
        busy={busy}
        purchaseFailed={notice === "purchaseFailed"}
        onPurchase={() => void buy()}
        onLeave={firstClose && onLeave ? () => {
          track("paywall_leave", { surface: "firstClose" });
          onLeave();
        } : undefined}
      />
    </Screen>
  );
}

interface PlanRowForProps {
  plan: PlanId;
  priceLabel: string;
  noteLabel?: string | undefined;
  selected: boolean;
  reduceMotion: boolean;
  disabled: boolean;
  onSelect: () => void;
}

function PlanRowFor({ plan, priceLabel, noteLabel, selected, onSelect, reduceMotion, disabled }: PlanRowForProps) {
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
      reduceMotion={reduceMotion}
      disabled={disabled}
      onPress={onSelect}
    />
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  headline: {
    marginBottom: spacing.sm,
  },
  lead: {
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
  benefitText: { flex: 1 },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.pill,
  },
  plans: {
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
  legalActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  devReset: {
    marginTop: spacing.xl,
  },
});
