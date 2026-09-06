import { forwardRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { BrandMark } from "../../design/primitives/brand-mark";
import { WORDMARK } from "../../design/primitives/wordmark";
import {
  darkColors,
  hairline,
  minTouchTarget,
  onUnlock,
  radius,
  spacing,
  trackingWide,
  unlockAccent,
  unlockBg,
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
 * The ref is the capturable artifact (share-skill.ts): the body only —
 * the share row beneath it is a control, not part of what she sends.
 * The drawn mark sits with the wordmark, tinted to the light accent
 * explicitly because this card ignores the theme on purpose.
 */
export const SkillShareCard = forwardRef<View, SkillShareCardProps>(
  function SkillShareCard({ skillName, onShare, testID }, ref) {
  return (
    <View style={styles.card} testID={testID}>
      <View
        ref={ref}
        collapsable={false}
        style={[styles.body, { backgroundColor: unlockBg }]}
        testID={testID ? `${testID}-artifact` : undefined}
      >
        <View style={styles.rule} />
        <AppText variant="title" color={onUnlock} style={styles.centered}>
          {skillName}
        </AppText>
        <AppText
          variant="bodySoft"
          color={darkColors.inkSoft}
          style={styles.centered}
        >
          {strings.share.card.line}
        </AppText>
        <View style={styles.brand}>
          <BrandMark size="small" tint={unlockAccent} />
          <AppText
            variant="caption"
            color={darkColors.inkSoft}
            style={styles.wordmark}
          >
            {WORDMARK}
          </AppText>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        testID={testID ? `${testID}-share` : undefined}
        onPress={onShare}
        style={({ pressed }) => [styles.shareRow, { opacity: pressed ? 0.6 : 1 }]}
      >
        <AppText variant="body" color={unlockAccent}>
          {strings.share.action}
        </AppText>
      </Pressable>
    </View>
  );
  },
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: unlockBg,
    borderRadius: radius.card,
    alignSelf: "stretch",
  },
  body: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    // The captured image IS the card she saw: all four corners rounded,
    // clipped, on the card's own surface — not a "tab" with square
    // bottom corners (reviewer should-fix). The share row beneath sits
    // outside the capture and keeps the outer card's rounding.
    borderRadius: radius.card,
    overflow: "hidden",
  },
  rule: {
    width: spacing.xl,
    height: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: unlockAccent,
  },
  centered: {
    textAlign: "center",
  },
  brand: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  wordmark: {
    letterSpacing: trackingWide,
  },
  shareRow: {
    minHeight: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: hairline,
    borderTopColor: darkColors.line,
  },
});
