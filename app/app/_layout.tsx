import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useDeepLinkTracking } from "../src/analytics/deep-link";
import { useTheme } from "../src/design/theme";

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
