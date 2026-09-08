import { useRouter } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { VoiceAskScreen } from "../src/screens/voice-ask/voice-ask-screen";

// Public route (URL scheme): the one voice ask, between the preview and
// the player on her first session (lib/start-flow.ts). The guard wants a
// generated session waiting and the ask still owed; a cold open, or an
// ask already answered, lands on "/".
export default function VoiceAskRoute() {
  const router = useRouter();
  return (
    <RouteGuard requires="voiceAsk">
      <VoiceAskScreen onDone={() => router.replace("/session")} />
    </RouteGuard>
  );
}
