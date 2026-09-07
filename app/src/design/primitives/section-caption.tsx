import { StyleSheet } from "react-native";

import { spacing } from "../tokens";
import { AppText } from "./app-text";

// The eyebrow above a grouped list (owner rule, 2026-09-06 round 5):
// captions sit OUTSIDE the tile, never inside it with the content they
// label. One caption per group, in the caption scale, a 12pt breath
// above the surface it names. Announced as a header so a screen reader
// walks the page group by group.

interface SectionCaptionProps {
  label: string;
  testID?: string;
}

export function SectionCaption({ label, testID }: SectionCaptionProps) {
  return (
    <AppText
      variant="caption"
      style={styles.caption}
      accessibilityRole="header"
      testID={testID}
    >
      {label}
    </AppText>
  );
}

const styles = StyleSheet.create({
  caption: {
    marginBottom: spacing.sm + spacing.xs,
  },
});
