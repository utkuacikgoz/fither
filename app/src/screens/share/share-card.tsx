import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";

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

interface ShareCardProps {
  /** The card's one line: where, how long, complete (or the week's count). */
  headline: string;
  /** The count line beneath it. */
  sub: string;
  /** The movement drawn on the card; "" draws nothing. */
  movementId: string;
  /** The public host printed in the brand row; null prints nothing. */
  host: string | null;
  testID?: string;
}

/**
 * The shareable receipt card (mockup share-receipt, owner-approved
 * 2026-09-07): white, the green as a rule, one movement drawn in black,
 * the headline, the count line, then the mark, the wordmark and the
 * public host. Theme-fixed like the skill card, because the image is the
 * artifact and looks the same wherever it lands. The ref is what gets
 * captured (share-receipt.ts); the actions live on the screen beneath.
 * Nothing about her body, her notes or her restrictions is a prop here,
 * so nothing of the kind can be drawn.
 */
export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { headline, sub, movementId, host, testID },
  ref,
) {
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
      <AppText
        variant="title"
        color={unlockBg}
        {...(testID ? { testID: `${testID}-headline` } : {})}
      >
        {headline}
      </AppText>
      <AppText variant="bodySoft" color={lightColors.inkSoft}>
        {sub}
      </AppText>
      <View style={styles.brand}>
        <BrandMark size="small" tint={unlockAccent} />
        <AppText variant="caption" color={lightColors.inkSoft} style={styles.wordmark}>
          {WORDMARK}
        </AppText>
        {host !== null ? (
          <AppText
            variant="caption"
            color={lightColors.inkSoft}
            style={styles.host}
            {...(testID ? { testID: `${testID}-host` } : {})}
          >
            {host}
          </AppText>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  body: {
    alignSelf: "stretch",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm + spacing.xs,
    // The captured image IS the card she saw: all four corners rounded,
    // clipped, on the card's own surface.
    borderRadius: radius.card,
    overflow: "hidden",
  },
  rule: {
    width: spacing.xl + spacing.sm,
    height: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: unlockAccent,
  },
  brand: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  wordmark: {
    letterSpacing: trackingWide,
  },
  host: {
    marginLeft: "auto",
  },
});
