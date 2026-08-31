import { useRouter } from "expo-router";

import { DailyPromptScreen } from "../src/screens/daily-prompt/daily-prompt-screen";

// The app opens into the daily prompt — Gate 3 is open-to-moving in
// under 60 seconds.
export default function Index() {
  const router = useRouter();
  return <DailyPromptScreen onSessionReady={() => router.replace("/session")} />;
}
