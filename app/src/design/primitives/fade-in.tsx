import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";

import { motion } from "../tokens";

interface FadeInProps {
  /**
   * When Reduce Motion is on, content appears in its FINAL state with no
   * animation — full opacity, no offset, never a half-played frame.
   */
  reduceMotion: boolean;
  /**
   * Milliseconds before this element starts. Staggered siblings pass
   * multiples of motion.staggerMs; 0 (the default) starts immediately.
   */
  delayMs?: number;
  /**
   * Rise distance in points (motion.riseDistance is the token). 0 keeps
   * the plain fade — the original behaviour of this primitive.
   */
  rise?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * A quiet appearance: one ease-out fade over motion.fadeMs, optionally
 * with a small rise and a stagger delay (ADR-0013 — motion is the
 * default). Nothing bounces, nothing springs.
 */
export function FadeIn({
  reduceMotion,
  delayMs = 0,
  rise = 0,
  style,
  children,
}: FadeInProps) {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.fadeMs,
      delay: delayMs,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion, delayMs]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [rise, 0],
  });

  return (
    <Animated.View
      style={[style, { opacity: progress, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}
