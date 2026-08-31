import { useRouter } from "expo-router";

import { FinishScreen } from "../src/screens/finish/finish-screen";
import { useSessionStore } from "../src/state/session-store";

export default function FinishRoute() {
  const router = useRouter();
  const hasUnlock = useSessionStore(
    (s) => (s.finish?.unlockedSkills.length ?? 0) > 0,
  );
  const resetSession = useSessionStore((s) => s.resetSession);
  return (
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
  );
}
