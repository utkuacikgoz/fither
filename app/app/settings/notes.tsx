import { Stack } from "expo-router";

import { useTheme } from "../../src/design/theme";
import { pushedHeaderOptions } from "../../src/lib/pushed-header";
import { RouteGuard } from "../../src/lib/route-guard";
import { NotesPage } from "../../src/screens/settings/pages/notes-page";

// Settings → Your notes, pushed over the tabs from its row. Wears the
// shared transparent back header (ADR-0017); the change saves on tap,
// so the chevron is the whole way out. Hydration-guarded like the tab.
export default function SettingsNotesPageRoute() {
  const colors = useTheme();
  return (
    <>
      <Stack.Screen options={pushedHeaderOptions(colors)} />
      <RouteGuard requires="hydratedOnly">
        <NotesPage />
      </RouteGuard>
    </>
  );
}
