import { useRouter } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { maybeRequestReview } from "../src/lib/rating";
import { FinishScreen } from "../src/screens/finish/finish-screen";
import { reminderAskDue } from "../src/state/reminder-store";
import { ratingMomentReached, useRatingStore } from "../src/state/rating-store";
import { useSessionStore } from "../src/state/session-store";

// Public route (URL scheme): completion is only claimed over a finished
// session (or its already-applied summary). A cold open with neither
// goes back to "/" — never a "Session complete" over nothing.
//
// Leaving here is one of the decided out-of-session moments (launch
// checklist), in strict order of precedence:
//   1. an unlocked skill → /unlock owns the exit (celebration first;
//      any rating moment fires when SHE leaves that screen instead);
//   2. the one-time notification ask, owed only after a close with
//      completed work behind it (reminderAskDue guards once-ever);
//   3. the system rating prompt — only after a plain "completed" close,
//      and only from her SECOND such session onward. Never her first,
//      never mid-session, never over the ask (the ask only exists while
//      the completed count is below the rating gate).
export default function FinishRoute() {
  const router = useRouter();
  const hasUnlock = useSessionStore(
    (s) => (s.finish?.unlockedSkills.length ?? 0) > 0,
  );
  const resetSession = useSessionStore((s) => s.resetSession);
  return (
    <RouteGuard requires="finishedSession">
      <FinishScreen
        onContinue={() => {
          const { finish } = useSessionStore.getState();
          // The close reason exactly as the store recorded it; the `??`
          // covers only legacy summaries that predate the close field.
          const closeReason = finish?.close?.reason ?? "completed";
          if (finish && closeReason === "completed") {
            useRatingStore.getState().recordCompletedClose();
          }
          if (hasUnlock) {
            router.replace("/unlock");
            return;
          }
          if (finish?.completedAnything && reminderAskDue()) {
            // The summary stays alive for /reminder-ask's guard; that
            // route resets the session when she leaves it.
            router.replace("/reminder-ask");
            return;
          }
          if (finish && closeReason === "completed" && ratingMomentReached()) {
            maybeRequestReview();
          }
          resetSession();
          // Straight to the hub (reviewer should-fix): "/" is the launch
          // surface, which paints its holding line for a frame on every
          // warm pass. Every gate the launch surface applies — sign-in,
          // onboarding, resume — is impossible right after a session, and
          // the hub route holds the entitlement gate itself.
          router.replace("/home");
        }}
      />
    </RouteGuard>
  );
}
