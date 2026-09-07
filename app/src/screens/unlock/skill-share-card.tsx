import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { BrandMark } from "../../design/primitives/brand-mark";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { WORDMARK } from "../../design/primitives/wordmark";
import {
  lightColors,
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
  /** The movement drawn on the card; "" draws nothing (library absent). */
  movementId: string;
  testID?: string;
}

/**
 * The shareable skill card (ADR-0017, owner-approved 2026-09-07): a white
 * card on the black unlock, the green as a rule, the movement drawn in
 * black above its name. Deliberately theme-fixed: the card is the
 * artifact she shares, and it looks the same wherever it lands. The ref
 * is the capturable artifact (share-skill.ts); the share action lives on
 * the screen beneath it, never on the image.
 */
export const SkillShareCard = forwardRef<View, SkillShareCardProps>(
  function SkillShareCard({ skillName, movementId, testID }, ref) {
    return (
      <View
        ref={ref}
        collapsable={false}
        style={[styles.body, { backgroundColor: onUnlock }]}
        testID={testID}
      >
        <View style={styles.rule} />
        <MovementFigure
          movementId={movementId}
          size="large"
          tint={unlockBg}
          {...(testID ? { testID: `${testID}-figure` } : {})}
        />
        <AppText variant="title" color={unlockBg} style={styles.centered}>
          {skillName}
        </AppText>
        <AppText
          variant="bodySoft"
          color={lightColors.inkSoft}
          style={styles.centered}
        >
          {strings.share.card.line}
        </AppText>
        <View style={styles.brand}>
          <BrandMark size="small" tint={unlockAccent} />
          <AppText
            variant="caption"
            color={lightColors.inkSoft}
            style={styles.wordmark}
          >
            {WORDMARK}
          </AppText>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  body: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    // The captured image IS the card she saw: all four corners rounded,
    // clipped, on the card's own surface.
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  wordmark: {
    letterSpacing: trackingWide,
  },
});
