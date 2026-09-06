import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { useTheme } from "../src/design/theme";
import { pushedHeaderOptions } from "../src/lib/pushed-header";
import { RouteGuard } from "../src/lib/route-guard";
import { DailyPromptScreen } from "../src/screens/daily-prompt/daily-prompt-screen";

// The four decided questions (ADR-0003/0006), now a pushed flow entered
// from the home card (ADR-0013 §4) rather than the app's front door.
// Deliberately OUTSIDE the tab group: the session flow — prompt,
// preview, player, finish — shows no tab bar.
//
// The way back is the platform's own: the shared pushed-screen header
// (lib/pushed-header.ts) — a transparent bar carrying only the back
// chevron, the same on every pushed route in this app.
//
// Guarded on entitlement, exactly like the hub: an expired, unpurchased
// trial cannot generate a new session, so the questions are not
// rendered at all — the wrong path is prevented upstream, and "/" shows
// the gated day instead of a wall after four answers.
//
// `handoff=1` is set once, by the launch surface, straight after
// onboarding: it renders the drafted handoff eyebrow atop the first
// question (ADR-0009 §1). Nothing else ever sets it.
export default function PromptRoute() {
  const colors = useTheme();
  const router = useRouter();
  const { handoff } = useLocalSearchParams<{ handoff?: string }>();
  return (
    <>
      <Stack.Screen options={pushedHeaderOptions(colors)} />
      <RouteGuard requires="entitledToStart">
        <DailyPromptScreen
          showHandoff={handoff === "1"}
          onSessionReady={() => router.replace("/preview")}
        />
      </RouteGuard>
    </>
  );
}
