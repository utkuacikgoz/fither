import { View } from "react-native";

import { strings } from "../../../copy/strings";
import { QuietButton } from "../../../design/primitives/quiet-button";
import { SettingsRow } from "../../../design/primitives/settings-row";
import { useReducedMotion } from "../../../lib/use-reduced-motion";
import { manageSubscription } from "../../../monetization/manage-subscription";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { RestoreNotice, useRestorePurchase } from "../restore-purchase";
import { SettingsGroup } from "../settings-group";
import { planPrice, planValue } from "../settings-values";
import { SettingsSubpage } from "./settings-subpage";

// Subscription (mockup settings-plan): one line of plain fact, the plan
// she holds and its price as fact rows (not buttons), then the two
// actions at the foot — Manage subscription (change plan, cancel,
// refund: Apple's own flows through the store's Customer Center, or
// Apple's subscriptions page without the key, ADR-0014 — never a dead
// end) and Restore purchase, whose notice lands right under it.
//
// The mockup's "Renews" row is NOT rendered: the purchase record the
// billing port hands the app carries the plan, the purchase date and
// the trial flag, and no renewal date. Inventing one from the plan
// length would be billing arithmetic in the UI; the row returns when
// the port exposes the store's own expiry.

export function PlanPage() {
  const reduceMotion = useReducedMotion();
  const purchase = useEntitlementStore((s) => s.purchase);
  const { restore, notice } = useRestorePurchase();
  const price = planPrice(purchase);
  return (
    <SettingsSubpage
      title={strings.settings.restore.title}
      lead={strings.settings.plan.intro}
      testID="settings-plan"
      bottom={
        <View>
          <QuietButton
            testID="settings-manage-subscription"
            label={strings.settings.restore.manage}
            outlined
            onPress={() => {
              void manageSubscription();
            }}
          />
          <QuietButton testID="plan-restore" label={strings.paywall.restore} onPress={restore} />
          <RestoreNotice notice={notice} />
        </View>
      }
    >
      <SettingsGroup reduceMotion={reduceMotion} testID="settings-plan-facts">
        <SettingsRow
          testID="plan-row-plan"
          label={strings.settings.rows.plan}
          value={planValue(purchase)}
          divider={price !== null}
        />
        {price !== null && (
          <SettingsRow
            testID="plan-row-price"
            label={strings.settings.plan.price}
            value={price}
            divider={false}
          />
        )}
      </SettingsGroup>
    </SettingsSubpage>
  );
}
