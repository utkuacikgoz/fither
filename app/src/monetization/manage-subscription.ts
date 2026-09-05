import { Linking } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";

import { revenueCatConfigured } from "./revenuecat-billing";

// "Manage subscription" (Settings → Subscription): RevenueCat's Customer
// Center when the store is connected — change plan, cancel, refund, all
// Apple-native under the hood — and otherwise Apple's own subscriptions
// page, so the row is never a dead end on a build without the key.
// Neither path is on the training path; both are her choice to open.

const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

export async function manageSubscription(): Promise<void> {
  try {
    if (revenueCatConfigured()) {
      await RevenueCatUI.presentCustomerCenter();
      return;
    }
  } catch {
    // The centre failed to present — fall through to Apple's page.
  }
  try {
    await Linking.openURL(APPLE_SUBSCRIPTIONS_URL);
  } catch {
    // Nothing more we can do; the row's press feedback was the answer.
  }
}
