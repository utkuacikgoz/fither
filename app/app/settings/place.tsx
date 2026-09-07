import { Stack } from "expo-router";

import { useTheme } from "../../src/design/theme";
import { pushedHeaderOptions } from "../../src/lib/pushed-header";
import { RouteGuard } from "../../src/lib/route-guard";
import { PlacePage } from "../../src/screens/settings/pages/place-page";

// Settings → Where I train, pushed over the tabs from its row. Wears the
// shared transparent back header (ADR-0017); every change saves on tap,
// so the chevron is the whole way out. Hydration-guarded like the tab.
export default function SettingsPlacePageRoute() {
  const colors = useTheme();
  return (
    <>
      <Stack.Screen options={pushedHeaderOptions(colors)} />
      <RouteGuard requires="hydratedOnly">
        <PlacePage />
      </RouteGuard>
    </>
  );
}
