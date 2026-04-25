import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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

type Props = { onComplete: () => void };

export function AnimatedSplash({ onComplete }: Props) {
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

  useEffect(() => {
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
