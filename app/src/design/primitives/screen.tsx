import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { spacing } from "../tokens";

interface ScreenProps {
  children: ReactNode;
  /** Override the bone background (unlock moment only). */
  backgroundColor?: string;
}

/**
 * Full-screen container: bone background, safe-area aware, 24pt side
 * margins. One focal point per screen — the container stays quiet.
 */
export function Screen({ children, backgroundColor }: ScreenProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: backgroundColor ?? colors.bg,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
});
