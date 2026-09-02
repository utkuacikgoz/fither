import { useRouter } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { SessionPlayerScreen } from "../src/screens/session-player/session-player-screen";

// Public route (URL scheme): the player only makes sense with a session
// in flight. A cold open lands on "/" — where the launch surface's
// resume offer owns any crash-persisted session from today.
export default function SessionRoute() {
  const router = useRouter();
  return (
    <RouteGuard requires="activeSession">
      <SessionPlayerScreen onFinished={() => router.replace("/finish")} />
    </RouteGuard>
  );
}
