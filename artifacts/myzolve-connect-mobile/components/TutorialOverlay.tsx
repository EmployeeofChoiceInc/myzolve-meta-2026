import { Feather } from "@expo/vector-icons";
import { TUTORIAL_STEPS } from "@workspace/tutorial-content";
import React, { useEffect, useState, type ComponentProps } from "react";
import { Modal, Pressable, View } from "react-native";

import { AppText, Button, Row } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

// Full-screen guided tutorial for mobile.  Renders one step at a time as a
// modal card with a big icon, title, body, and Next/Skip controls.  The last
// step swaps "Next" for "Done".  Skip is always available so users can bail
// at any time.

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function TutorialOverlay({ visible, onClose }: Props) {
  const c = useColors();
  const [stepIndex, setStepIndex] = useState(0);

  // Reset to the first step every time the modal opens fresh.
  useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  const step = TUTORIAL_STEPS[stepIndex];
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  function next() {
    if (isLast) {
      onClose();
    } else {
      setStepIndex((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1));
    }
  }

  function back() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (!step) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        accessibilityViewIsModal
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          testID="tutorial-card"
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: c.card,
            borderRadius: 28,
            padding: 24,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          {/* Step indicator + skip */}
          <Row align="center" style={{ marginBottom: 16 }}>
            <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
              {TUTORIAL_STEPS.map((s, i) => (
                <View
                  key={s.id}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: i <= stepIndex ? c.primary : c.muted,
                  }}
                />
              ))}
            </View>
            {!isLast ? (
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Skip tour"
                hitSlop={12}
                testID="button-tutorial-skip"
                style={{ marginLeft: 12 }}
              >
                <AppText variant="caption" color={c.mutedForeground}>
                  Skip
                </AppText>
              </Pressable>
            ) : null}
          </Row>

          {/* Big icon */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              alignSelf: "center",
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: c.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginVertical: 16,
            }}
          >
            <Feather
              name={step.featherIcon as FeatherIconName}
              size={32}
              color={c.primary}
            />
          </View>

          <AppText
            variant="h2"
            accessibilityRole="header"
            style={{ textAlign: "center", marginBottom: 10 }}
          >
            {step.title}
          </AppText>
          <AppText
            color={c.mutedForeground}
            style={{ textAlign: "center", marginBottom: 24, lineHeight: 22 }}
          >
            {step.body}
          </AppText>

          <Row gap={10}>
            {stepIndex > 0 ? (
              <View style={{ flex: 1 }}>
                <Button
                  title="Back"
                  variant="ghost"
                  onPress={back}
                  testID="button-tutorial-back"
                />
              </View>
            ) : null}
            <View style={{ flex: stepIndex > 0 ? 1.4 : 1 }}>
              <Button
                title={isLast ? "Done" : "Next"}
                onPress={next}
                testID={isLast ? "button-tutorial-done" : "button-tutorial-next"}
              />
            </View>
          </Row>
        </View>
      </View>
    </Modal>
  );
}
