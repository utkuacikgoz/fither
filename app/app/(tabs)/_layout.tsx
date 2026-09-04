import { Tabs } from "expo-router";

import { strings } from "../../src/copy/strings";
import { useTheme } from "../../src/design/theme";
import { fontFamily, hairline, typeScale } from "../../src/design/tokens";

// The hub's bottom tab bar (ADR-0013 §4): Home / Progress / Settings.
// Only these three routes live inside the group — the whole session
// flow (/prompt, /preview, /session, /finish, /unlock), the launch
// surface ("/"), /reminder-ask and /sign-in are siblings in the root
// stack, so they push OVER the tabs and the bar is never on screen
// during a workout. The session stays sacred (design system §2).
//
// Chrome only: bone background, hairline top border, sage active label,
// soft ink inactive — all tokens. Labels carry the tabs; no icon set
// exists yet (Brief 6 identity), and an invented glyph would signify
// less than the word does. `title` is the tab label, taken from
// strings.ts: "Today" for the day's hub, then Progress and Settings.

export default function TabsLayout() {
  const colors = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.line,
          borderTopWidth: hairline,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.text,
          fontSize: typeScale.caption,
        },
        tabBarIconStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: strings.prompt.dayLabel }} />
      <Tabs.Screen name="progress" options={{ title: strings.profile.title }} />
      <Tabs.Screen name="settings" options={{ title: strings.settings.title }} />
    </Tabs>
  );
}
