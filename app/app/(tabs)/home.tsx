import { RouteGuard } from "../../src/lib/route-guard";
import { entitlementStatus, isEntitled } from "../../src/monetization/entitlement";
import { useFreeSessionsAllowance } from "../../src/monetization/experiment";
import { GatedDailySurface } from "../../src/screens/launch/gated-daily-surface";
import { HomeScreen } from "../../src/screens/home/home-screen";
import { useEntitlementStore } from "../../src/state/entitlement-store";

// The hub (ADR-0013 §4). Reached from "/" once the launch surface's
// gating order has run — resume decision, sign-in, onboarding — so this
// route never decides any of those itself.
//
// It does apply the entitlement rule, reactively: on a gated day the
// Today tab IS the gated day (the paywall letter where the questions
// would be, her record's doors intact — ADR-0009 §3), rendered inline.
// It used to redirect to "/", which mounted the launch surface, painted
// its holding line, and landed back on the same letter — a tab that
// bounced (reviewer should-fix). Constraints: what can't apply is not
// rendered, and nothing else is either.
function TodayTab() {
  const trialStartDate = useEntitlementStore((s) => s.trialStartDate);
  const purchase = useEntitlementStore((s) => s.purchase);
  const trialUsed = useEntitlementStore((s) => s.trialUsed);
  const qualifyingSessions = useEntitlementStore((s) => s.qualifyingSessions);
  const freeSessions = useFreeSessionsAllowance();
  const entitled = isEntitled(
    entitlementStatus({
      firstCompletedDate: trialStartDate,
      purchase,
      trialUsed,
      qualifyingSessions,
      freeSessions,
    }),
  );
  return entitled ? <HomeScreen /> : <GatedDailySurface />;
}

export default function HomeRoute() {
  return (
    <RouteGuard requires="hydratedOnly">
      <TodayTab />
    </RouteGuard>
  );
}
