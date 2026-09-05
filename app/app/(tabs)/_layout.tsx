import { StyleSheet } from "react-native";
import { Tabs } from "expo-router";

import { strings } from "../../src/copy/strings";
import { AppText } from "../../src/design/primitives/app-text";
import { useTheme } from "../../src/design/theme";
import { fontFamily, fontWeight, hairline, typeScale } from "../../src/design/tokens";

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
        // The active tab is told by weight as well as hue: sage against
        // soft ink is a hue difference only (1.03:1 in luminance), which
        // is no signifier at all with a colour-vision deficiency
        // (reviewer should-fix). `tabBarLabel` with the router's own
        // `focused` flag is the one place that knows which tab is on.
        tabBarLabel: ({ focused, color, children }) => (
          <AppText
            variant="caption"
            // The router hands a ColorValue; ours are always token strings.
            color={String(color)}
            style={focused ? styles.activeLabel : undefined}
          >
            {children}
          </AppText>
        ),
        tabBarIconStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: strings.prompt.dayLabel }} />
      <Tabs.Screen name="progress" options={{ title: strings.profile.title }} />
      <Tabs.Screen name="settings" options={{ title: strings.settings.title }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeLabel: {
    fontWeight: fontWeight.semibold,
  },
});
