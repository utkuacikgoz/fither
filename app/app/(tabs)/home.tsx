import { RouteGuard } from "../../src/lib/route-guard";
import { HomeScreen } from "../../src/screens/home/home-screen";

// The hub (ADR-0013 §4). Reached from "/" once the launch surface's
// gating order has run — resume decision, sign-in, onboarding, the
// gated day — so this route never decides any of those itself.
//
// It does hold the same entitlement requirement the launch surface
// applies, because a tab is directly reachable (from Progress or
// Settings, or by URL): an expired, unpurchased trial belongs on the
// gated day at "/", where the paywall letter and her record live.
// Everything a subscription does NOT gate stays reachable — Progress
// and Settings are their own tabs (ADR-0009 §3).
export default function HomeRoute() {
  return (
    <RouteGuard requires="entitledToStart">
      <HomeScreen />
    </RouteGuard>
  );
}
