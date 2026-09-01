import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The system Reduce Motion setting, kept live. Defaults to false until
 * the (async) first read lands — callers that gate an animation behind a
 * user-visible delay (e.g. the block-intro exit reveal) see the settled
 * value long before it matters.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {
        // Unknown -> keep the default; motion here is already gentle.
      });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
