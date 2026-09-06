import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useDeepLinkTracking } from "../src/analytics/deep-link";
import { useAppFonts } from "../src/design/fonts";
import { useTheme } from "../src/design/theme";
import { getMonitoring } from "../src/monitoring/monitoring";

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
