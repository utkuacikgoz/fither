import type { ComponentProps } from "react";
import type { Stack } from "expo-router";

import type { ColorTheme } from "../design/tokens";

type StackScreenOptions = NonNullable<ComponentProps<typeof Stack.Screen>["options"]>;

/**
 * The one header every pushed screen wears (ADR-0017): transparent, no
 * title, the platform's own back chevron in the theme's ink. The way
 * back is always in the same place — the daily prompt, the preview and
 * the lifetime offer share it; the session, finish and unlock screens
 * deliberately do not (they have one forward door each).
 */
export function pushedHeaderOptions(colors: ColorTheme): StackScreenOptions {
  return {
    headerShown: true,
    headerTransparent: true,
    headerTitle: "",
    headerBackButtonDisplayMode: "minimal",
    headerTintColor: colors.ink,
    headerShadowVisible: false,
  };
}
