import { useRouter } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { PaywallScreen } from "../src/screens/paywall/paywall-screen";
import { useSessionStore } from "../src/state/session-store";

/** The optional, earned offer after the first session and weekly choice. */
export default function TrialOfferRoute() {
  const router = useRouter();
  const resetSession = useSessionStore((state) => state.resetSession);
  const finish = () => {
    resetSession();
    router.replace("/home");
  };
  return (
    <RouteGuard requires="firstCloseOffer">
      <PaywallScreen firstClose onLeave={finish} onEntitled={finish} />
    </RouteGuard>
  );
}
