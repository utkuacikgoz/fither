import { useRouter } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { FinishScreen } from "../src/screens/finish/finish-screen";
import { useSessionStore } from "../src/state/session-store";

// Public route (URL scheme): completion is only claimed over a finished
// session (or its already-applied summary). A cold open with neither
// goes back to "/" — never a "Session complete" over nothing.
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
          if (hasUnlock) {
            router.replace("/unlock");
          } else {
            resetSession();
            router.replace("/");
          }
        }}
      />
    </RouteGuard>
  );
}
