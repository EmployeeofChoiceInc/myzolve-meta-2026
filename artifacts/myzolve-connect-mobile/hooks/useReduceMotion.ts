import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Returns true when the user has "Reduce Motion" enabled in their OS
 * accessibility settings. Components should use this to gate spring,
 * parallax, or other vestibular-triggering animations.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (!cancelled) setReduce(!!v);
      })
      .catch(() => {
        if (!cancelled) setReduce(false);
      });

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => setReduce(!!v),
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduce;
}
