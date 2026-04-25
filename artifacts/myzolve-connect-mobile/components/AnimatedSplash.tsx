import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const SPLASH_BG = "#F4E8CC";
const HEART = require("@/assets/images/splash/heart.png");
const LEAVES = require("@/assets/images/splash/leaves.png");

const HEART_FADE_MS = 500;
const HEART_HOLD_MS = 200;
const LEAVES_FADE_MS = 400;
const FULL_HOLD_MS = 300;
const OVERLAY_FADE_MS = 250;

const REDUCED_FADE_MS = 350;
const REDUCED_HOLD_MS = 500;

type Props = { onComplete: () => void; onLayout?: () => void };

export function AnimatedSplash({ onComplete, onLayout }: Props) {
  const heartOpacity = useSharedValue(0);
  const heartScale = useSharedValue(0.94);
  const leavesOpacity = useSharedValue(0);
  const leavesTranslate = useSharedValue(-10);
  const overlayOpacity = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  // Guard so onComplete fires at most once even if both the timed
  // fade-out and the tap-to-skip both reach completion.
  const completedRef = useRef(false);
  const finishOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  // Defer animation start until onLayout fires (or a 250ms safety
  // fallback in case onLayout is delayed in production builds).  This
  // ensures the animation never plays hidden behind the dismissing
  // native splash.
  const animationStartedRef = useRef(false);
  const startAnimation = useCallback(() => {
    if (animationStartedRef.current) return;
    animationStartedRef.current = true;

    const finish = () => {
      "worklet";
      runOnJS(finishOnce)();
    };

    if (reduceMotion) {
      heartOpacity.value = withTiming(1, { duration: REDUCED_FADE_MS });
      leavesOpacity.value = withTiming(1, { duration: REDUCED_FADE_MS });
      heartScale.value = 1;
      leavesTranslate.value = 0;
      overlayOpacity.value = withDelay(
        REDUCED_FADE_MS + REDUCED_HOLD_MS,
        withTiming(0, { duration: OVERLAY_FADE_MS }, (finished) => {
          "worklet";
          if (finished) finish();
        }),
      );
    } else {
      heartOpacity.value = withTiming(1, {
        duration: HEART_FADE_MS,
        easing: Easing.out(Easing.cubic),
      });
      heartScale.value = withTiming(1, {
        duration: HEART_FADE_MS + 100,
        easing: Easing.out(Easing.back(1.2)),
      });

      const leavesStart = HEART_FADE_MS + HEART_HOLD_MS;
      leavesOpacity.value = withDelay(
        leavesStart,
        withTiming(1, {
          duration: LEAVES_FADE_MS,
          easing: Easing.out(Easing.cubic),
        }),
      );
      leavesTranslate.value = withDelay(
        leavesStart,
        withTiming(0, {
          duration: LEAVES_FADE_MS + 100,
          easing: Easing.out(Easing.cubic),
        }),
      );

      const fadeOutAt = leavesStart + LEAVES_FADE_MS + FULL_HOLD_MS;
      overlayOpacity.value = withDelay(
        fadeOutAt,
        withTiming(0, { duration: OVERLAY_FADE_MS }, (finished) => {
          "worklet";
          if (finished) finish();
        }),
      );
    }
  }, [
    reduceMotion,
    heartOpacity,
    heartScale,
    leavesOpacity,
    leavesTranslate,
    overlayOpacity,
    finishOnce,
  ]);

  // Safety net: if onLayout never fires (rare, but possible if the
  // overlay is recycled or laid out off-screen), trigger the same
  // handoff (notify parent so it hides the native splash, then start
  // the animation) after a short delay so the user is never stuck on
  // a blank cream screen.  We notify the parent FIRST so the native
  // splash dismisses before/with the animation start, matching the
  // primary handleLayout path.
  const layoutNotifiedRef = useRef(false);
  const notifyLayoutOnce = useCallback(() => {
    if (layoutNotifiedRef.current) return;
    layoutNotifiedRef.current = true;
    onLayout?.();
  }, [onLayout]);

  useEffect(() => {
    const t = setTimeout(() => {
      notifyLayoutOnce();
      startAnimation();
    }, 250);
    return () => clearTimeout(t);
  }, [notifyLayoutOnce, startAnimation]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      notifyLayoutOnce();
      startAnimation();
      // Reference the event so RN doesn't pool/reuse it before consumers read it.
      void e;
    },
    [notifyLayoutOnce, startAnimation],
  );

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }));
  const leavesStyle = useAnimatedStyle(() => ({
    opacity: leavesOpacity.value,
    transform: [{ translateY: leavesTranslate.value }],
  }));

  const handleSkip = () => {
    if (completedRef.current) return;
    overlayOpacity.value = withTiming(
      0,
      { duration: 180 },
      (finished) => {
        "worklet";
        if (finished) runOnJS(finishOnce)();
      },
    );
  };

  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
      onLayout={handleLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel="MyZolve Connect"
    >
      <Pressable
        onPress={handleSkip}
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Skip animation"
      >
        <View style={styles.center} pointerEvents="none">
          <View style={styles.markFrame}>
            <Animated.Image
              source={HEART}
              resizeMode="contain"
              style={[styles.layer, heartStyle]}
            />
            <Animated.Image
              source={LEAVES}
              resizeMode="contain"
              style={[styles.layer, leavesStyle]}
            />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: SPLASH_BG,
    zIndex: 9999,
    elevation: 9999,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  markFrame: {
    width: 240,
    height: 240,
    position: "relative",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
});
