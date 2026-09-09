import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useDeepLinkTracking } from "../src/analytics/deep-link";
import { startPersonSync } from "../src/analytics/person";
import { useAppFonts } from "../src/design/fonts";
import { useTheme } from "../src/design/theme";
import { getMonitoring } from "../src/monitoring/monitoring";
import { useFeedbackStore } from "../src/state/feedback-store";
import { rescheduleInvitation } from "../src/state/reminder-store";

// Crash reporting starts before the first render (ADR-0016): the SDK's
// global handlers must be in place for anything the tree throws. Without
// a DSN this is the quiet adapter and a no-op.
getMonitoring().init();

// The splash holds until the typeface is in (ADR-0017); a failed load
// releases it too, so a font can never keep her on the launch image.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const colors = useTheme();
  // deep_link_open (ADR-0015): the root is the one place that sees every
  // incoming URL, cold or warm.
  useDeepLinkTracking();
  const fontsReady = useAppFonts();
  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsReady]);
  // Person properties (ADR-0015): one subscription over the stores her
  // six facts are read from, started here because the root outlives
  // every screen. It sends nothing until those stores have hydrated,
  // then once, and after that only when a value actually changes — so
  // no store has to call analytics back (that ran both ways and made a
  // require cycle).
  useEffect(() => startPersonSync(), []);
  // The daily invitation's body names her week (ADR-0018 as amended by
  // wave 2). Weekly triggers repeat, so a week away would replay a stale count: every
  // return to the foreground reschedules from today's history. Best
  // effort by contract; a no-op without a chosen slot or permission.
  // Feedback written offline goes on the next foreground the same way.
  useEffect(() => {
    const onForeground = () => {
      void rescheduleInvitation();
      void useFeedbackStore.getState().flush();
    };
    onForeground();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") onForeground();
    });
    return () => subscription.remove();
  }, []);
  if (!fontsReady) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </SafeAreaProvider>
  );
}
