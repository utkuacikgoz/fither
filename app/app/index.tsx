import { useRouter } from "expo-router";

import { LaunchScreen } from "../src/screens/launch/launch-screen";

// The app opens into the launch surface, which still owns the gating
// order (ADR-0013 §4 changed the destination, not the order): resume
// decision → sign-in → onboarding → gated day → home. Only the last
// step moved — where the daily prompt used to render, the hub now
// takes over at /home, and the four questions are one push away.
//
// Deliberately NOT wrapped in RouteGuard: "/" is the guard's redirect
// target (no loop wanted), the launch surface already owns the same
// hydration wait, and it must mount immediately so Gate 3's t0 mark
// (firstMovementTracker.markLaunch) keeps counting hydration time.
export default function Index() {
  const router = useRouter();
  return (
    <LaunchScreen
      onHome={() => router.replace("/home")}
      // Straight after onboarding she goes to the questions directly,
      // handoff eyebrow and all — the hub's extra tap is not spent on
      // her first run, so Gate 3's path is unchanged (ADR-0013 §5).
      onPromptHandoff={() => router.replace("/prompt?handoff=1")}
      onResumeSession={() => router.replace("/session")}
      onResumeFinished={() => router.replace("/finish")}
    />
  );
}
