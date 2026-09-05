import { useRouter } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { maybeRequestReview } from "../src/lib/rating";
import { UnlockScreen } from "../src/screens/unlock/unlock-screen";
import { reminderAskDue } from "../src/state/reminder-store";
import { ratingMomentReached } from "../src/state/rating-store";
import { useSessionStore } from "../src/state/session-store";

// Public route (URL scheme): the one loud screen fires only for a skill
// actually unlocked this session. A cold open with nothing pending goes
// back to "/" — never an empty celebration.
//
// Leaving the unlock (Continue) is a decided rating moment (launch
// checklist: after experienced value — a skill unlock) — but only from
// her second completed session onward, so her first ever close is never
// interrupted. The completed-close count was recorded on the way out of
// /finish; nothing increments here. The one-time notification ask takes
// the same exit when it is still owed (first completed session — which
// is exactly when the rating gate cannot be reached yet).
export default function UnlockRoute() {
  const router = useRouter();
  const resetSession = useSessionStore((s) => s.resetSession);
  return (
    <RouteGuard requires="pendingUnlock">
      <UnlockScreen
        onContinue={() => {
          const { finish } = useSessionStore.getState();
          if (finish?.completedAnything && reminderAskDue()) {
            router.replace("/reminder-ask");
            return;
          }
          if (ratingMomentReached()) {
            maybeRequestReview();
          }
          resetSession();
          router.replace("/home");
        }}
      />
    </RouteGuard>
  );
}
