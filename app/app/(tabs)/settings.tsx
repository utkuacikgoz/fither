import { RouteGuard } from "../../src/lib/route-guard";
import { SettingsScreen } from "../../src/screens/settings/settings-screen";

// Settings is a tab (ADR-0013 §4), so the way back is the tab bar
// itself — no header, no in-app back chevron. Always a valid
// destination — the guard only waits for hydration so a cold open never
// shows unhydrated defaults.
export default function SettingsRoute() {
  return (
    <RouteGuard requires="hydratedOnly">
      <SettingsScreen />
    </RouteGuard>
  );
}
