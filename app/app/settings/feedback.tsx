import { Stack } from "expo-router";

import { useTheme } from "../../src/design/theme";
import { pushedHeaderOptions } from "../../src/lib/pushed-header";
import { RouteGuard } from "../../src/lib/route-guard";
import { FeedbackPage } from "../../src/screens/settings/pages/feedback-page";

// Settings → Send feedback, pushed over the tabs from its Account row.
export default function SettingsFeedbackRoute() {
  const colors = useTheme();
  return (
    <>
      <Stack.Screen options={pushedHeaderOptions(colors)} />
      <RouteGuard requires="hydratedOnly">
        <FeedbackPage />
      </RouteGuard>
    </>
  );
}
