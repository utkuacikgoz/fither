import { StyleSheet } from "react-native";

import { AppText } from "./app-text";

// The brand mark, not copy: it never localises and the copy-writer does
// not own it — same footing as the glyph tokens. Typeset in the display
// style until the Brief 6 identity lands (a drawn mark swaps in here).
// Exported for the copy-audit tests' allowlists, the same way dev-only
// labels are.
export const WORDMARK = "FITHER";

/** The calm brand moment: the wordmark, centred, nothing else. */
export function Wordmark() {
  return (
    <AppText variant="display" style={styles.mark} accessibilityRole="header">
      {WORDMARK}
    </AppText>
  );
}

const styles = StyleSheet.create({
  mark: {
    textAlign: "center",
  },
});
