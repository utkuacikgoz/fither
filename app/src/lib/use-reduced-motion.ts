import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// The system Reduce Motion setting, kept live — and remembered across
// mounts. The OS read is asynchronous; a hook that seeds `false` on every
// mount hands each screen one wrong first frame, and a Reduce Motion user
// watched every entrance start, then snap (reviewer should-fix). The
// last known value lives at module level: the first mount in a process
// still pays one async read (absorbed by the launch surface's hydration
// wait), every later mount starts already correct, and the change
// listener keeps the cache honest while the app is open.

let known: boolean | null = null;
let firstRead: Promise<boolean> | null = null;

function readOnce(): Promise<boolean> {
  if (firstRead === null) {
    firstRead = AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        known = value;
        return value;
      })
      .catch(() => {
        // Unknown -> keep the default; motion here is already gentle.
        return known ?? false;
      });
  }
  return firstRead;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(known ?? false);

  useEffect(() => {
    let mounted = true;
    void readOnce().then((value) => {
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        known = value;
        setReduced(value);
      },
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/** Test seam: forget the cached setting between tests. */
export function resetReducedMotionForTests(): void {
  known = null;
  firstRead = null;
}
