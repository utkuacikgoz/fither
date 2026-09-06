import { StyleSheet } from "react-native";
import { Tabs } from "expo-router";

import { strings } from "../../src/copy/strings";
import { AppText } from "../../src/design/primitives/app-text";
import { TabIcon } from "../../src/design/primitives/tab-icon";
import { useTheme } from "../../src/design/theme";
import { fontFamily, hairline, spacing } from "../../src/design/tokens";

// The hub's bottom tab bar (ADR-0013 §4, redrawn in ADR-0017): Today /
// Progress / Settings. Only these three routes live inside the group —
// the whole session flow (/prompt, /preview, /session, /finish,
// /unlock), the launch surface ("/"), /reminder-ask and /sign-in are
// siblings in the root stack, so they push OVER the tabs and the bar is
// never on screen during a workout. The session stays sacred.
//
// Chrome: the page ground, a hairline top, a generated line icon over a
// short label. The active tab is told by the green AND by weight, so it
// survives a colour-vision deficiency; the router's own `focused` flag
// is the one place that knows which tab is on.

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
          paddingTop: spacing.sm,
        },
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
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: strings.prompt.dayLabel,
          tabBarIcon: ({ color }) => (
            <TabIcon name="today" color={String(color)} testID="tab-icon-today" />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: strings.profile.title,
          tabBarIcon: ({ color }) => (
            <TabIcon name="progress" color={String(color)} testID="tab-icon-progress" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: strings.settings.title,
          tabBarIcon: ({ color }) => (
            <TabIcon name="settings" color={String(color)} testID="tab-icon-settings" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeLabel: {
    fontFamily: fontFamily.bold,
  },
});
