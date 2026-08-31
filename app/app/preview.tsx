import { useRouter } from "expo-router";

import { SessionPreviewScreen } from "../src/screens/session-preview/session-preview-screen";

export default function PreviewRoute() {
  const router = useRouter();
  return <SessionPreviewScreen onStart={() => router.replace("/session")} />;
}
