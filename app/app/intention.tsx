import { useRouter } from "expo-router";

import { nextCloseAsk } from "../src/lib/close-flow";
import { RouteGuard } from "../src/lib/route-guard";
import { maybeRequestReview } from "../src/lib/rating";
import { IntentionAskScreen } from "../src/screens/intention/intention-ask-screen";
import { ratingMomentReached } from "../src/state/rating-store";
import { useSessionStore } from "../src/state/session-store";

// Public route (URL scheme): the one weekly-intention ask (wave 2), shown
// only on the way out of a close with an attempted block, and only while
// the ask has never run (the guard checks both). Sits between the finish
// (or the unlock) and the notification ask in lib/close-flow.ts's order.
// The finish summary stays alive across it: the reminder ask's guard
// still needs it, so this route resets the session only when it is the
// last stop before home.
export default function IntentionRoute() {
  const router = useRouter();
  const resetSession = useSessionStore((s) => s.resetSession);
  return (
    <RouteGuard requires="intentionAsk">
      <IntentionAskScreen
        onDone={() => {
          const { finish } = useSessionStore.getState();
          // Answered now, so the intention is no longer owed; what
          // remains is the reminder ask, or nothing.
          const ask = nextCloseAsk(finish);
          if (ask) {
            router.replace(ask);
            return;
          }
          // The same rating rule as the finish exit it stands in for:
          // only a plain "completed" close, only from the gate onward.
          const closeReason = finish?.close?.reason ?? "completed";
          if (finish && closeReason === "completed" && ratingMomentReached()) {
            maybeRequestReview();
          }
          resetSession();
          router.replace("/home");
        }}
      />
    </RouteGuard>
  );
}
