import { router } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { LifetimeOfferScreen } from "../src/screens/lifetime-offer/lifetime-offer-screen";

// The day-3 lifetime offer (ADR-0014), pushed over the hub by the hub's
// own trigger once the offer store has claimed the one ask. Leaving,
// either way, returns to the hub.
export default function LifetimeOfferRoute() {
  return (
    <RouteGuard requires="hydratedOnly">
      <LifetimeOfferScreen onDone={() => router.replace("/home")} />
    </RouteGuard>
  );
}
