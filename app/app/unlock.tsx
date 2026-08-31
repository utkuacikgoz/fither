import { useRouter } from "expo-router";

import { UnlockScreen } from "../src/screens/unlock/unlock-screen";
import { useSessionStore } from "../src/state/session-store";

export default function UnlockRoute() {
  const router = useRouter();
  const resetSession = useSessionStore((s) => s.resetSession);
  return (
    <UnlockScreen
      onContinue={() => {
        resetSession();
        router.replace("/");
      }}
    />
  );
}
