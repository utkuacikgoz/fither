import { RouteGuard } from "../../src/lib/route-guard";
import { HomeScreen } from "../../src/screens/home/home-screen";

// The hub (ADR-0013 §4). Reached from "/" once the launch surface's
// gating order has run — resume decision, sign-in, onboarding — so this
// route never decides any of those itself.
//
// Home keeps her completed work, weekly rhythm and recaps accessible
// after she declines the optional offer (ADR-0028). The prompt route
// enforces entitlement before any new session can be generated.
export default function HomeRoute() {
  return (
    <RouteGuard requires="hydratedOnly">
      <HomeScreen />
    </RouteGuard>
  );
}
