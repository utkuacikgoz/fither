import { router, Stack } from "expo-router";
import { View } from "react-native";

import { spacing } from "../../src/design/tokens";
import { useTheme } from "../../src/design/theme";
import { pushedHeaderOptions } from "../../src/lib/pushed-header";
import { RouteGuard } from "../../src/lib/route-guard";
import { PaywallScreen } from "../../src/screens/paywall/paywall-screen";

// Settings → Subscription → Start my free week (owner decision 2026-09-21,
// after App Review twice could not find the purchase: the trial offer
// appears only after a first session with a completed block, and until
// now nothing else in the app led to it). The same paywall, pushed over
// the tabs with the shared back header; a grant returns her to the plan
// page, which now shows what she holds.
export default function SettingsSubscribeRoute() {
  const colors = useTheme();
  return (
    <>
      <Stack.Screen options={pushedHeaderOptions(colors)} />
      <RouteGuard requires="hydratedOnly">
        <PaywallScreen
          headerSlot={<View style={{ height: spacing.xxl }} />}
          onEntitled={() => router.back()}
        />
      </RouteGuard>
    </>
  );
}
