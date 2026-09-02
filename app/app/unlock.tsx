import { useRouter } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { UnlockScreen } from "../src/screens/unlock/unlock-screen";
import { useSessionStore } from "../src/state/session-store";

// Public route (URL scheme): the one loud screen fires only for a skill
// actually unlocked this session. A cold open with nothing pending goes
// back to "/" — never an empty celebration.
export default function UnlockRoute() {
  const router = useRouter();
  const resetSession = useSessionStore((s) => s.resetSession);
  return (
    <RouteGuard requires="pendingUnlock">
      <UnlockScreen
        onContinue={() => {
          resetSession();
          router.replace("/");
        }}
      />
    </RouteGuard>
  );
}
