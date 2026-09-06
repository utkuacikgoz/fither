import { Image, StyleSheet } from "react-native";

// The tab bar's three glyphs (ADR-0017): generated line icons in the
// figures' stroke (scripts/generate-tab-icons.py), one white asset each,
// tinted by the bar with the theme — the brand mark's pattern. Purely
// decorative: the tab's label and the router's selected state carry the
// meaning for assistive tech, so the image is hidden from it.

/* eslint-disable @typescript-eslint/no-require-imports */
const SOURCES = {
  today: require("../../../assets/icons/tab-today.png"),
  progress: require("../../../assets/icons/tab-progress.png"),
  settings: require("../../../assets/icons/tab-settings.png"),
} as const;
/* eslint-enable @typescript-eslint/no-require-imports */

export type TabIconName = keyof typeof SOURCES;

/** The box the icons were drawn for (see the generator). */
export const TAB_ICON_SIZE = 28;

interface TabIconProps {
  name: TabIconName;
  /** Token colour handed down by the tab bar (active or inactive tint). */
  color: string;
  testID?: string;
}

export function TabIcon({ name, color, testID }: TabIconProps) {
  return (
    <Image
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      source={SOURCES[name]}
      resizeMode="contain"
      style={[styles.icon, { tintColor: color }]}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    width: TAB_ICON_SIZE,
    height: TAB_ICON_SIZE,
  },
});
