import { Stack } from "expo-router";

import { useTheme } from "../src/design/theme";
import { RouteGuard } from "../src/lib/route-guard";
import { SettingsScreen } from "../src/screens/settings/settings-screen";

// Settings is a pushed route, so the way back is the platform's own: a
// transparent native header carrying only the back chevron
// (system-provided chrome, not app copy). The screen renders its own
// title beneath it. Always a valid destination — the guard only waits
// for hydration so a cold open never shows unhydrated defaults.
export default function SettingsRoute() {
  const colors = useTheme();
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: "",
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: colors.accent,
        }}
      />
      <RouteGuard requires="hydratedOnly">
        <SettingsScreen />
      </RouteGuard>
    </>
  );
}
