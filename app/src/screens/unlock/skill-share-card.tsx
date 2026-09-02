import { Pressable, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { WORDMARK } from "../../design/primitives/wordmark";
import {
  hairline,
  lightColors,
  minTouchTarget,
  radius,
  spacing,
} from "../../design/tokens";

// The card typesets the shared WORDMARK constant in its own small,
// letter-spaced style — the primitive's display treatment belongs to the
// launch/sign-in brand moment, not a card corner.
export { WORDMARK };

interface SkillShareCardProps {
  skillName: string;
  onShare: () => void;
  testID?: string;
}

/**
 * The shareable skill card, rendered in-app on the unlock moment. It is
 * deliberately theme-fixed (light tokens): the card is the artifact she
 * shares, and it looks the same wherever it lands. Gold appears as the
 * accent rule — text stays ink/inkSoft so contrast holds AA on surface.
 * v1 shares text via the system sheet; image export is a later swap.
 */
export function SkillShareCard({ skillName, onShare, testID }: SkillShareCardProps) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.body}>
        <View style={styles.goldRule} />
        <AppText variant="title" color={lightColors.ink} style={styles.centered}>
          {skillName}
        </AppText>
        <AppText
          variant="bodySoft"
          color={lightColors.inkSoft}
          style={styles.centered}
        >
          {strings.share.card.line}
        </AppText>
        <AppText
          variant="caption"
          color={lightColors.inkSoft}
          style={styles.wordmark}
        >
          {WORDMARK}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        testID={testID ? `${testID}-share` : undefined}
        onPress={onShare}
        style={({ pressed }) => [styles.shareRow, { opacity: pressed ? 0.6 : 1 }]}
      >
        <AppText variant="body" color={lightColors.accent}>
          {strings.share.action}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.card,
    alignSelf: "stretch",
  },
  body: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  goldRule: {
    width: spacing.xl,
    height: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: lightColors.gold,
  },
  centered: {
    textAlign: "center",
  },
  wordmark: {
    marginTop: spacing.xs,
    letterSpacing: 2,
  },
  shareRow: {
    minHeight: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: hairline,
    borderTopColor: lightColors.line,
  },
});
