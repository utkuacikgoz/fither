import { Stack, useLocalSearchParams } from "expo-router";

import { useTheme } from "../src/design/theme";
import { pushedHeaderOptions } from "../src/lib/pushed-header";
import { RouteGuard } from "../src/lib/route-guard";
import { LadderScreen, parseLadderPattern } from "../src/screens/progress/ladder-screen";

// One pattern's ladder, pushed over the tabs from a Progress row or the
// next-skill tile (owner decision 2026-09-14, design A2), wearing the
// shared back header (ADR-0017). `pattern` is untrusted text: anything
// that is not one of the five ladders shows the first. Reads owned
// records only, so hydration is all the guard needs.
export default function LadderRoute() {
  const colors = useTheme();
  const { pattern } = useLocalSearchParams<{ pattern?: string | string[] }>();
  return (
    <>
      <Stack.Screen options={pushedHeaderOptions(colors)} />
      <RouteGuard requires="hydratedOnly">
        <LadderScreen pattern={parseLadderPattern(pattern)} />
      </RouteGuard>
    </>
  );
}
