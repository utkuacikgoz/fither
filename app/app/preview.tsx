import { Stack, useRouter } from "expo-router";

import { useTheme } from "../src/design/theme";
import { pushedHeaderOptions } from "../src/lib/pushed-header";
import { RouteGuard } from "../src/lib/route-guard";
import { nextStartRoute } from "../src/lib/start-flow";
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
  const colors = useTheme();
  return (
    <>
      {/* The shared pushed-screen header (ADR-0017): the chevron leads
          back to wherever she came from — the hub, most days. */}
      <Stack.Screen options={pushedHeaderOptions(colors)} />
      <RouteGuard requires="generatedSession">
        <SessionPreviewScreen
          onStart={() => router.replace(nextStartRoute())}
          onChangeAnswers={() => router.replace("/prompt")}
        />
      </RouteGuard>
    </>
  );
}
