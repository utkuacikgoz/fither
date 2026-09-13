import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, type PressableProps } from "react-native";

import { motion } from "../tokens";

interface PressSurfaceProps extends PressableProps {
  reduceMotion: boolean;
}

/** Native-driver feedback; the action never waits for the animation. */
export function PressSurface({
  reduceMotion,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: PressSurfaceProps) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion || disabled) {
      progress.stopAnimation();
      progress.setValue(0);
    }
    return () => progress.stopAnimation();
  }, [progress, reduceMotion, disabled]);

  const settle = (pressed: boolean) => {
    progress.stopAnimation();
    if (reduceMotion) {
      progress.setValue(0);
      return;
    }
    Animated.timing(progress, {
      toValue: pressed ? 1 : 0,
      duration: pressed ? motion.pressInMs : motion.pressOutMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, motion.pressOpacity] }),
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, motion.pressScale] }) }],
      }}
    >
      <Pressable
        {...props}
        disabled={disabled}
        onPressIn={(event) => {
          settle(true);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          settle(false);
          onPressOut?.(event);
        }}
      />
    </Animated.View>
  );
}
