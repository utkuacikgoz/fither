import { useRouter } from "expo-router";

import { LaunchScreen } from "../src/screens/launch/launch-screen";

// The app opens into the launch surface: the daily prompt (Gate 3 is
// open-to-moving in under 60 seconds), unless a crash-persisted session
// from today asks for the resume decision first.
export default function Index() {
  const router = useRouter();
  return (
    <LaunchScreen
      onSessionReady={() => router.replace("/preview")}
      onResumeSession={() => router.replace("/session")}
      onResumeFinished={() => router.replace("/finish")}
    />
  );
}
