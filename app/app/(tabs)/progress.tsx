import { RouteGuard } from "../../src/lib/route-guard";
import { ProgressScreen } from "../../src/screens/progress/progress-screen";

// Progress is a tab (ADR-0013 §4), so the way back is the tab bar
// itself — no header, no in-app back chevron. Always a valid
// destination: it shows records she owns, and an expired trial never
// takes them away (ADR-0009 §3), so the guard only waits for hydration
// (never zeros from unhydrated stores on a cold open).
export default function ProgressRoute() {
  return (
    <RouteGuard requires="hydratedOnly">
      <ProgressScreen />
    </RouteGuard>
  );
}
