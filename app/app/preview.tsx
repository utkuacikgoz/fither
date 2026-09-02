import { useRouter } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { SessionPreviewScreen } from "../src/screens/session-preview/session-preview-screen";

// Public route (URL scheme): a cold open has no generated session to
// preview, so the guard sends it back to the launch surface instead of
// rendering an empty plan.
export default function PreviewRoute() {
  const router = useRouter();
  return (
    <RouteGuard requires="generatedSession">
      <SessionPreviewScreen
        onStart={() => router.replace("/session")}
        onChangeAnswers={() => router.replace("/")}
      />
    </RouteGuard>
  );
}
