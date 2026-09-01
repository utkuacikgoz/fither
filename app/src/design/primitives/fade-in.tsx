import { useEffect, useRef, type ReactNode } from "react";
import { Animated } from "react-native";

import { motion } from "../tokens";

interface FadeInProps {
  /**
   * When Reduce Motion is on, content appears at full opacity with no
   * animation — same content, same timing, just no fade.
   */
  reduceMotion: boolean;
  children: ReactNode;
}

/**
 * A quiet appearance: one ease-out fade (motion.fadeMs), nothing more.
 * Motion is breath, not fireworks.
 */
export function FadeIn({ reduceMotion, children }: FadeInProps) {
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: motion.fadeMs,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
