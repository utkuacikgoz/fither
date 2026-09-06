import { router, Stack } from "expo-router";

import { useTheme } from "../src/design/theme";
import { pushedHeaderOptions } from "../src/lib/pushed-header";
import { RouteGuard } from "../src/lib/route-guard";
import { LifetimeOfferScreen } from "../src/screens/lifetime-offer/lifetime-offer-screen";

// The day-3 lifetime offer (ADR-0014), pushed over the hub by the hub's
// own trigger once the offer store has claimed the one ask. Leaving,
// either way, returns to the hub.
export default function LifetimeOfferRoute() {
  const colors = useTheme();
  return (
    <>
      {/* Pushed over the hub; the chevron is the "not now" she can always
          take without reading (ADR-0017). */}
      <Stack.Screen options={pushedHeaderOptions(colors)} />
      <RouteGuard requires="hydratedOnly">
        <LifetimeOfferScreen onDone={() => router.replace("/home")} />
      </RouteGuard>
    </>
  );
}
