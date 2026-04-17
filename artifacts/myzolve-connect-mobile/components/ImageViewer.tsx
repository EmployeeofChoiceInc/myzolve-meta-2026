import React, { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
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
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

const AnimatedImage = Animated.createAnimatedComponent(Image);

export type ImageViewerItem = {
  uri: string;
  headers?: Record<string, string>;
};

type Props = {
  visible: boolean;
  images: ImageViewerItem[];
  initialIndex?: number;
  onClose: () => void;
};

function extensionFromUri(uri: string): string {
  const clean = uri.split("?")[0].split("#")[0];
  const tail = clean.split("/").pop() ?? "";
  const ext = tail.includes(".") ? tail.split(".").pop()! : "jpg";
  const lower = ext.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(lower)) {
    return lower === "jpeg" ? "jpg" : lower;
  }
  return "jpg";
}

async function downloadToCache(
  uri: string,
  headers?: Record<string, string>,
): Promise<string> {
  const ext = extensionFromUri(uri);
  const target = `${FileSystem.cacheDirectory}wall-photo-${Date.now()}.${ext}`;
  const result = await FileSystem.downloadAsync(uri, target, { headers });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Download failed (${result.status})`);
  }
  return result.uri;
}

export function ImageViewer({ visible, images, initialIndex = 0, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = Dimensions.get("window");

  const total = images.length;

  // If asked to be visible with no images, close instead of showing an empty modal.
  useEffect(() => {
    if (visible && total === 0) onClose();
  }, [visible, total, onClose]);

  const clampedInitial = Math.min(Math.max(initialIndex, 0), Math.max(0, total - 1));
  const [index, setIndex] = useState(clampedInitial);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [busy, setBusy] = useState(false);

  // Pager (absolute strip translateX, negative)
  const pagerX = useSharedValue(-clampedInitial * screenW);

  // Per-image transform (applies to current page)
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);

  // Worklet refs for gesture logic
  const idxRef = useSharedValue(clampedInitial);
  const lenRef = useSharedValue(total);
  const widthRef = useSharedValue(screenW);
  const mode = useSharedValue(0); // 0 = none, 1 = horizontal, 2 = vertical

  function resetZoom() {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    backdropOpacity.value = 1;
  }

  // When viewer opens, initialize state.
  useEffect(() => {
    if (visible) {
      setIndex(clampedInitial);
      idxRef.value = clampedInitial;
      pagerX.value = -clampedInitial * screenW;
      resetZoom();
      setLoading(true);
      setErrored(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, clampedInitial]);

  // Keep worklet refs in sync.
  useEffect(() => {
    lenRef.value = total;
  }, [total, lenRef]);
  useEffect(() => {
    widthRef.value = screenW;
  }, [screenW, widthRef]);

  // When index changes (after a swipe completes), reset zoom + loading.
  useEffect(() => {
    idxRef.value = index;
    pagerX.value = -index * screenW;
    resetZoom();
    setLoading(true);
    setErrored(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const goToIndex = (n: number) => setIndex(n);

  const resetCurrentImage = () => {
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
        resetCurrentImage();
      }
    });

  const pan = Gesture.Pan()
    .minDistance(5)
    .onStart(() => {
      mode.value = 0;
    })
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
        return;
      }
      if (mode.value === 0) {
        const ax = Math.abs(e.translationX);
        const ay = Math.abs(e.translationY);
        if (ax > ay && ax > 6) mode.value = 1;
        else if (ay > 6) mode.value = 2;
      }
      if (mode.value === 1) {
        let dx = e.translationX;
        if (
          (idxRef.value === 0 && dx > 0) ||
          (idxRef.value === lenRef.value - 1 && dx < 0)
        ) {
          dx = dx / 3;
        }
        pagerX.value = -idxRef.value * widthRef.value + dx;
      } else if (mode.value === 2) {
        translateY.value = e.translationY;
        const progress = Math.min(Math.abs(e.translationY) / 300, 1);
        backdropOpacity.value = 1 - progress * 0.7;
      }
    })
    .onEnd((e) => {
      if (scale.value > 1) {
        const maxX = (widthRef.value * (scale.value - 1)) / 2;
        const maxY = (screenH * (scale.value - 1)) / 2;
        translateX.value = withTiming(
          Math.max(-maxX, Math.min(translateX.value, maxX)),
        );
        translateY.value = withTiming(
          Math.max(-maxY, Math.min(translateY.value, maxY)),
        );
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
        mode.value = 0;
        return;
      }
      if (mode.value === 1) {
        const threshold = widthRef.value / 3;
        let newIndex = idxRef.value;
        if (
          (e.translationX < -threshold || e.velocityX < -800) &&
          idxRef.value < lenRef.value - 1
        ) {
          newIndex = idxRef.value + 1;
        } else if (
          (e.translationX > threshold || e.velocityX > 800) &&
          idxRef.value > 0
        ) {
          newIndex = idxRef.value - 1;
        }
        if (newIndex !== idxRef.value) {
          pagerX.value = withTiming(
            -newIndex * widthRef.value,
            { duration: 220 },
            () => {
              runOnJS(goToIndex)(newIndex);
            },
          );
        } else {
          pagerX.value = withTiming(-idxRef.value * widthRef.value);
        }
      } else if (mode.value === 2) {
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
      mode.value = 0;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        resetCurrentImage();
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

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pagerX.value }],
  }));

  const currentImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const currentImage = images[index];

  async function saveToLibrary() {
    if (!currentImage || busy) return;
    setBusy(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow photo library access in Settings to save photos.",
        );
        return;
      }
      const localUri = await downloadToCache(currentImage.uri, currentImage.headers);
      await MediaLibrary.saveToLibraryAsync(localUri);
      try {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      } catch {
        // ignore cleanup failure
      }
      Alert.alert("Saved", "Photo saved to your library.");
    } catch (err) {
      Alert.alert(
        "Couldn't save photo",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sharePhoto() {
    if (!currentImage || busy) return;
    setBusy(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Sharing isn't available on this device.");
        return;
      }
      const localUri = await downloadToCache(currentImage.uri, currentImage.headers);
      await Sharing.shareAsync(localUri, { dialogTitle: "Share photo" });
      try {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      } catch {
        // ignore cleanup failure
      }
    } catch (err) {
      Alert.alert(
        "Couldn't share photo",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openSaveMenu() {
    if (!currentImage || busy || errored) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Save to Photos", "Share…"],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) saveToLibrary();
          else if (idx === 2) sharePhoto();
        },
      );
    } else {
      Alert.alert("Photo", undefined, [
        { text: "Save to Photos", onPress: saveToLibrary },
        { text: "Share…", onPress: sharePhoto },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  const canAct = !!currentImage && !errored;

  return (
    <Modal
      visible={visible && total > 0}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={composed}>
          <Animated.View
            style={[
              styles.strip,
              { width: screenW * Math.max(total, 1), height: screenH },
              stripStyle,
            ]}
          >
            {images.map((img, i) => {
              const isCurrent = i === index;
              const shouldRender = Math.abs(i - index) <= 1;
              return (
                <View
                  key={`${i}-${img.uri}`}
                  style={{ width: screenW, height: screenH }}
                >
                  {!shouldRender ? null : isCurrent && !errored ? (
                    <AnimatedImage
                      source={{ uri: img.uri, headers: img.headers }}
                      style={[styles.image, currentImageStyle]}
                      contentFit="contain"
                      onLoadStart={() => setLoading(true)}
                      onLoad={() => setLoading(false)}
                      onError={() => {
                        setLoading(false);
                        setErrored(true);
                      }}
                    />
                  ) : (
                    <Image
                      source={{ uri: img.uri, headers: img.headers }}
                      style={styles.image}
                      contentFit="contain"
                    />
                  )}
                </View>
              );
            })}
          </Animated.View>
        </GestureDetector>
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
        {total > 1 ? (
          <View
            style={[styles.counter, { top: insets.top + 14 }]}
            pointerEvents="none"
          >
            <Animated.Text style={styles.counterText}>
              {index + 1} / {total}
            </Animated.Text>
          </View>
        ) : null}
        <Pressable
          accessibilityLabel="Close photo"
          onPress={onClose}
          style={[styles.iconBtn, styles.closeBtn, { top: insets.top + 8 }]}
          hitSlop={12}
        >
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        {canAct ? (
          <Pressable
            accessibilityLabel="Save or share photo"
            onPress={openSaveMenu}
            disabled={busy}
            style={[
              styles.iconBtn,
              styles.saveBtn,
              { top: insets.top + 8, opacity: busy ? 0.6 : 1 },
            ]}
            hitSlop={12}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Feather name="share" size={20} color="#fff" />
            )}
          </Pressable>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: "#000" },
  strip: { flexDirection: "row" },
  image: { flex: 1, width: "100%", height: "100%" },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { color: "#fff", fontSize: 14 },
  counter: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  counterText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  iconBtn: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    right: 16,
  },
  saveBtn: {
    left: 16,
  },
});
