import { Stack, useLocalSearchParams } from "expo-router";

import { useTheme } from "../src/design/theme";
import { pushedHeaderOptions } from "../src/lib/pushed-header";
import { RouteGuard } from "../src/lib/route-guard";
import {
  RecapScreen,
  type RecapSource,
} from "../src/screens/recap/recap-screen";

// The weekly recap (wave 2), pushed from Settings → Weekly recaps or a
// link, wearing the shared back header (ADR-0017). Public route (URL
// scheme): `week` is untrusted text naming ANY date in the week to show;
// anything that is not a yyyy-mm-dd falls back to the week containing
// today. Hydration is all the guard needs: the page reads owned records
// only, and a week with nothing in it is still a truthful page.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The route's `week` when it is a yyyy-mm-dd; otherwise undefined (today). */
export function parseRecapWeek(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return typeof single === "string" && ISO_DATE.test(single) ? single : undefined;
}

export function parseRecapSource(value: string | string[] | undefined): RecapSource {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "home" || single === "settings" ? single : "link";
}

export default function RecapRoute() {
  const colors = useTheme();
  const { week, source } = useLocalSearchParams<{
    week?: string | string[];
    source?: string | string[];
  }>();
  const parsed = parseRecapWeek(week);
  return (
    <>
      <Stack.Screen options={pushedHeaderOptions(colors)} />
      <RouteGuard requires="hydratedOnly">
        <RecapScreen
          {...(parsed !== undefined ? { week: parsed } : {})}
          source={parseRecapSource(source)}
        />
      </RouteGuard>
    </>
  );
}
