import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { motion, radius, spacing } from "../tokens";
import { AppText } from "./app-text";

// A short confirmation that something happened, shown over the screen it
// happened on and gone by itself (owner, 2026-09-12: the skip
// confirmation screen was deleted, so the skip needs to be legible
// without one). It is never a decision: nothing here is tappable, and no
// flow ever waits on it. Anything the user must answer belongs on a
// screen, not in a toast.
//
// It announces itself to VoiceOver as a polite live region, so it is
// spoken without stealing focus from whatever she is doing.

interface ToastProps {
  /** The line to show. A new message restarts the toast. */
  message: string | null;
  reduceMotion: boolean;
  /** Called once the toast has finished leaving, so the caller can clear it. */
  onHidden: () => void;
  testID?: string;
}

export function Toast({ message, reduceMotion, onHidden, testID }: ToastProps) {
  const colors = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  // The latest callback, read at fire time: a caller that re-renders must
  // not restart the timer, and a stale closure must not clear the wrong
  // message.
  const hidden = useRef(onHidden);
  hidden.current = onHidden;

  useEffect(() => {
    if (message === null) return;
    // Reduce Motion still gets the toast, just without the fade: the
    // information is the point, the movement is not.
    if (reduceMotion) {
      progress.setValue(1);
      const timer = setTimeout(() => {
        progress.setValue(0);
        hidden.current();
      }, motion.toastMs);
      return () => clearTimeout(timer);
    }
    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: motion.fadeMs,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.delay(motion.toastMs),
      Animated.timing(progress, {
        toValue: 0,
        duration: motion.fadeMs,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) hidden.current();
    });
    return () => animation.stop();
  }, [message, progress, reduceMotion]);

  if (message === null) return null;
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [motion.riseDistance, 0],
  });
  return (
    <View
      style={styles.stage}
      pointerEvents="none"
      {...(testID ? { testID: `${testID}-stage` } : {})}
    >
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: colors.surface, borderColor: colors.line },
          { opacity: progress, transform: [{ translateY }] },
        ]}
        accessibilityLiveRegion="polite"
        {...(testID ? { testID } : {})}
      >
        <AppText variant="body">{message}</AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    // Above the screen's own content, clear of the bottom controls so it
    // never covers the button she is reaching for.
    position: "absolute",
    left: 0,
    right: 0,
    bottom: spacing.xxl + spacing.xl,
    alignItems: "center",
  },
  toast: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.lg,
  },
});
