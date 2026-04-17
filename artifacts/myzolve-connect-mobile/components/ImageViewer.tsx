import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedImage = Animated.createAnimatedComponent(Image);

type Props = {
  visible: boolean;
  uri: string | undefined;
  headers?: Record<string, string>;
  onClose: () => void;
};

export function ImageViewer({ visible, uri, headers, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = Dimensions.get("window");

  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setErrored(false);
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      backdropOpacity.value = 1;
    }
  }, [visible, uri]);

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.max(1, Math.min(savedScale.value * e.scale, 5));
      scale.value = next;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.01) {
        reset();
      }
    });

  const pan = Gesture.Pan()
    .minDistance(5)
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      } else {
        // Swipe-down to dismiss when not zoomed
        translateY.value = e.translationY;
        const progress = Math.min(Math.abs(e.translationY) / 300, 1);
        backdropOpacity.value = 1 - progress * 0.7;
      }
    })
    .onEnd((e) => {
      if (scale.value > 1) {
        // Clamp pan within bounds
        const maxX = (screenW * (scale.value - 1)) / 2;
        const maxY = (screenH * (scale.value - 1)) / 2;
        translateX.value = withTiming(
          Math.max(-maxX, Math.min(translateX.value, maxX)),
        );
        translateY.value = withTiming(
          Math.max(-maxY, Math.min(translateY.value, maxY)),
        );
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        if (Math.abs(e.translationY) > 120 || Math.abs(e.velocityY) > 800) {
          backdropOpacity.value = withTiming(0, { duration: 150 });
          translateY.value = withTiming(
            e.translationY > 0 ? screenH : -screenH,
            { duration: 200 },
            () => {
              runOnJS(onClose)();
            },
          );
        } else {
          translateY.value = withTiming(0);
          backdropOpacity.value = withTiming(1);
        }
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .requireExternalGestureToFail(doubleTap)
    .onEnd(() => {
      runOnJS(onClose)();
    });

  const composed = Gesture.Simultaneous(
    pinch,
    pan,
    Gesture.Exclusive(doubleTap, singleTap),
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={composed}>
          <Animated.View style={styles.root}>
            {uri && !errored ? (
              <AnimatedImage
                source={{ uri, headers }}
                style={[styles.image, imageStyle]}
                contentFit="contain"
                onLoadStart={() => setLoading(true)}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setErrored(true);
                }}
              />
            ) : null}
            {loading && !errored ? (
              <View style={styles.center} pointerEvents="none">
                <ActivityIndicator color="#fff" size="large" />
              </View>
            ) : null}
            {errored ? (
              <View style={styles.center} pointerEvents="none">
                <Feather name="alert-circle" size={32} color="#fff" />
                <View style={{ height: 8 }} />
                <Animated.Text style={styles.errorText}>
                  Couldn't load this photo.
                </Animated.Text>
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
        <Pressable
          accessibilityLabel="Close photo"
          onPress={onClose}
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          hitSlop={12}
        >
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: "#000" },
  image: { flex: 1, width: "100%", height: "100%" },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { color: "#fff", fontSize: 14 },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
