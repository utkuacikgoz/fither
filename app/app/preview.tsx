import { useRouter } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { SessionPreviewScreen } from "../src/screens/session-preview/session-preview-screen";

// Public route (URL scheme): a cold open has no generated session to
// preview, so the guard sends it back to the launch surface instead of
// rendering an empty plan.
//
// "Change today's answers" goes back to the four questions (/prompt,
// where they live since ADR-0013 §4), which prefill with the answers
// the session store still holds — never to the hub, which would lose
// her place in the flow.
export default function PreviewRoute() {
  const router = useRouter();
  return (
    <RouteGuard requires="generatedSession">
      <SessionPreviewScreen
        onStart={() => router.replace("/session")}
        onChangeAnswers={() => router.replace("/prompt")}
      />
    </RouteGuard>
  );
}
