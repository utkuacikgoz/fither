import { Stack, useLocalSearchParams } from "expo-router";

import { useTheme } from "../src/design/theme";
import { pushedHeaderOptions } from "../src/lib/pushed-header";
import { RouteGuard } from "../src/lib/route-guard";
import { ShareScreen } from "../src/screens/share/share-screen";
import { parseShareDate, parseShareSource } from "../src/screens/share/share-subject";

// Share from a receipt or a recap (wave 3): pushed over the finish
// screen, a receipt or the weekly recap, wearing the shared back header
// (ADR-0017). Public route (URL scheme): `source` and `date` are read as
// untrusted text — an unknown source counts as a receipt, a malformed
// date as today — and the screen shows a truthful card for whatever the
// history holds. Hydration is all the guard needs: the card is drawn
// from owned records only, and a day with nothing in it still has its
// week.
export default function ShareRoute() {
  const colors = useTheme();
  const { source, date } = useLocalSearchParams<{
    source?: string | string[];
    date?: string | string[];
  }>();
  const parsedDate = parseShareDate(date);
  return (
    <>
      <Stack.Screen options={pushedHeaderOptions(colors)} />
      <RouteGuard requires="hydratedOnly">
        <ShareScreen
          source={parseShareSource(source)}
          {...(parsedDate !== undefined ? { date: parsedDate } : {})}
        />
      </RouteGuard>
    </>
  );
}
