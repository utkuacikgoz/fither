import { Stack } from "expo-router";

import { useTheme } from "../src/design/theme";
import { RouteGuard } from "../src/lib/route-guard";
import { ProgressScreen } from "../src/screens/progress/progress-screen";

// Progress is a pushed route like settings, so the way back is the
// platform's own: a transparent native header carrying only the back
// chevron (system-provided chrome, not app copy). The screen renders its
// own title beneath it. Always a valid destination — it shows records
// she owns — so the guard only waits for hydration (never zeros from
// unhydrated stores on a cold open).
export default function ProgressRoute() {
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
        <ProgressScreen />
      </RouteGuard>
    </>
  );
}
