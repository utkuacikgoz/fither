import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { nextMilestone } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { LadderStrip } from "../../design/primitives/ladder-strip";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Screen } from "../../design/primitives/screen";
import { WORDMARK } from "../../design/primitives/wordmark";
import { motion, spacing, trackingWide } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { getBilling } from "../../monetization/billing";
import { loadLibrary } from "../../session/load-library";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useProfileStore } from "../../state/profile-store";
import { PlanRow } from "../paywall/plan-row";

// The one-time lifetime offer (ADR-0014). Same honest-letter register as
// the paywall: the wordmark, a headline, the body, the ONE plan (the
// price lives on the plan row, never in prose — the paywall's own
// design), one primary action and an equal-dignity way out. Never shown
// twice: the offer store writes the asked date before this mounts.
// Nothing about renewal is rendered here — this purchase has none.

interface LifetimeOfferScreenProps {
  /** Leave the screen, whatever she chose. */
  onDone: () => void;
}

export function LifetimeOfferScreen({ onDone }: LifetimeOfferScreenProps) {
  const reduceMotion = useReducedMotion();
  const purchasePlan = useEntitlementStore((s) => s.purchasePlan);
  const offering = getBilling().getLifetimeOffering();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // The same picture the paywall sells with (ADR-0017): her ladder,
  // reached tiers in the green — this is what "keep the climb" means.
  const profile = useProfileStore((s) => s.profile);
  const library = loadLibrary();
  const ladderPattern = nextMilestone(profile)?.pattern ?? "push";
  const reached = profile.patterns[ladderPattern].tier;

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const result = await purchasePlan("lifetime");
    setBusy(false);
    if (result === "purchased") onDone();
    else if (result === "failed") setFailed(true);
    // "cancelled": she closed the sheet; the screen simply stays.
  };

  if (!offering) {
    // The store has no lifetime product: nothing honest to offer.
    onDone();
    return <Screen>{null}</Screen>;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
        <FadeIn reduceMotion={reduceMotion} rise={motion.riseDistance}>
          <AppText variant="caption" style={styles.letterhead}>
            {WORDMARK}
          </AppText>
          <AppText variant="display" style={styles.headline} accessibilityRole="header">
            {strings.lifetimeOffer.headline}
          </AppText>
          <AppText variant="bodySoft" style={styles.lead}>
            {strings.lifetimeOffer.lead}
          </AppText>
          <View style={styles.ladder}>
            <LadderStrip
              testID="lifetime-offer-ladder"
              library={library}
              pattern={ladderPattern}
              reached={reached}
              reduceMotion={reduceMotion}
            />
          </View>
          <AppText variant="body" style={styles.body}>
            {strings.lifetimeOffer.body}
          </AppText>
        </FadeIn>
        <FadeIn
          reduceMotion={reduceMotion}
          rise={motion.riseDistance}
          delayMs={motion.staggerMs}
        >
          <PlanRow
            testID="lifetime-offer-plan"
            label={strings.paywall.plans.lifetime.label}
            price={offering.priceLabel}
            note={offering.noteLabel}
            selected
            onPress={() => undefined}
          />
        </FadeIn>
      </ScrollView>
      <View style={styles.bottom}>
        {failed && (
          <AppText variant="bodySoft" style={styles.notice} testID="lifetime-offer-error">
            {strings.paywall.purchaseError}
          </AppText>
        )}
        <PrimaryButton
          testID="lifetime-offer-buy"
          label={strings.lifetimeOffer.cta}
          onPress={() => {
            void buy();
          }}
        />
        <QuietButton
          testID="lifetime-offer-decline"
          label={strings.lifetimeOffer.decline}
          onPress={onDone}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.xl,
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
  ladder: {
    marginBottom: spacing.lg,
  },
  body: {
    marginBottom: spacing.lg,
  },
  bottom: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  notice: {
    textAlign: "center",
  },
});
