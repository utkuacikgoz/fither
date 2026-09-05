import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useDeepLinkTracking } from "../src/analytics/deep-link";
import { useTheme } from "../src/design/theme";
import { getMonitoring } from "../src/monitoring/monitoring";

// Crash reporting starts before the first render (ADR-0016): the SDK's
// global handlers must be in place for anything the tree throws. Without
// a DSN this is the quiet adapter and a no-op.
getMonitoring().init();

export default function RootLayout() {
  const colors = useTheme();
  // deep_link_open (ADR-0015): the root is the one place that sees every
  // incoming URL, cold or warm.
  useDeepLinkTracking();
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
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
