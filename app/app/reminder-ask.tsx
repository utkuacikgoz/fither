import { useRouter } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { ReminderAskScreen } from "../src/screens/reminder-ask/reminder-ask-screen";
import { useSessionStore } from "../src/state/session-store";

// Public route (URL scheme): the one in-context notification ask, shown
// only on the way out of a close that completed work, and only while the
// ask has never run (the guard checks both). The finish summary is kept
// alive until she leaves HERE — this route owns the session reset that
// "/" would otherwise have gotten from the finish/unlock exit.
export default function ReminderAskRoute() {
  const router = useRouter();
  const resetSession = useSessionStore((s) => s.resetSession);
  return (
    <RouteGuard requires="reminderAsk">
      <ReminderAskScreen
        onDone={() => {
          resetSession();
          router.replace("/");
        }}
      />
    </RouteGuard>
  );
}
