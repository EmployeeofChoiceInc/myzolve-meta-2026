import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { AppText, Avatar, Card, Row } from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { useCopilot, useCopilotGrantsForCircle } from "@/lib/copilot";

interface Props {
  circleId: number;
  testID?: string;
}

/**
 * Renders an inline picker that lets a co-pilot choose whether they're
 * posting as themself, or on behalf of someone they've been asked to
 * help. If the current user has no co-pilot grants in this circle, this
 * component renders nothing — preserving the original solo flow.
 */
export function CopilotSwitcher({ circleId, testID }: Props) {
  const c = useColors();
  const grants = useCopilotGrantsForCircle(circleId);
  const { actingFor, setActingFor } = useCopilot();
  const [open, setOpen] = useState(false);

  if (grants.length === 0) {
    return null;
  }

  const currentTargetId = actingFor[circleId] ?? null;
  const currentGrant = currentTargetId
    ? grants.find((g) => g.grantorUserId === currentTargetId) ?? null
    : null;

  return (
    <>
      <Pressable
        testID={testID ?? "copilot-switcher"}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          marginBottom: 16,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Card
          style={{
            borderColor: currentGrant ? c.primary : c.border,
            borderWidth: 1,
            backgroundColor: currentGrant ? c.primarySoft : c.card,
          }}
        >
          <Row gap={12} align="center">
            <Feather
              name={currentGrant ? "user-check" : "user"}
              size={18}
              color={currentGrant ? c.primary : c.mutedForeground}
            />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color={c.mutedForeground}>
                Posting as
              </AppText>
              <AppText weight="semibold">
                {currentGrant
                  ? `Helper for ${currentGrant.grantorName ?? "this member"}`
                  : "Myself"}
              </AppText>
            </View>
            <Feather name="chevron-down" size={18} color={c.mutedForeground} />
          </Row>
        </Card>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <Row
            justify="space-between"
            style={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <Pressable onPress={() => setOpen(false)}>
              <AppText color={c.mutedForeground}>Cancel</AppText>
            </Pressable>
            <AppText weight="semibold">Who are you posting for?</AppText>
            <View style={{ width: 50 }} />
          </Row>

          <View style={{ padding: 20, gap: 10 }}>
            <AppText variant="caption" color={c.mutedForeground} style={{ marginBottom: 6 }}>
              Pick yourself or someone who's asked you to help.
            </AppText>

            <Pressable
              testID="copilot-pick-self"
              onPress={() => {
                setActingFor(circleId, null);
                setOpen(false);
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card
                style={{
                  borderColor: !currentTargetId ? c.primary : c.border,
                  borderWidth: 1,
                  backgroundColor: !currentTargetId ? c.primarySoft : c.card,
                }}
              >
                <Row gap={12} align="center">
                  <Feather name="user" size={20} color={c.foreground} />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">Myself</AppText>
                    <AppText variant="caption" color={c.mutedForeground}>
                      Post in your own name
                    </AppText>
                  </View>
                  {!currentTargetId ? (
                    <Feather name="check" size={18} color={c.primary} />
                  ) : null}
                </Row>
              </Card>
            </Pressable>

            {grants.map((g) => {
              const active = currentTargetId === g.grantorUserId;
              return (
                <Pressable
                  key={g.id}
                  testID={`copilot-pick-grant-${g.id}`}
                  onPress={() => {
                    setActingFor(circleId, g.grantorUserId);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Card
                    style={{
                      borderColor: active ? c.primary : c.border,
                      borderWidth: 1,
                      backgroundColor: active ? c.primarySoft : c.card,
                    }}
                  >
                    <Row gap={12} align="center">
                      <Avatar
                        name={g.grantorName ?? "Member"}
                        objectPath={g.grantorAvatarObjectPath}
                        size={36}
                      />
                      <View style={{ flex: 1 }}>
                        <AppText weight="semibold">
                          {g.grantorName ?? "Member"}
                        </AppText>
                        <AppText variant="caption" color={c.mutedForeground}>
                          They've asked you to help
                        </AppText>
                      </View>
                      {active ? (
                        <Feather name="check" size={18} color={c.primary} />
                      ) : null}
                    </Row>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

/**
 * A compact attribution badge used on cards & detail screens to make it
 * obvious that something was posted by a helper on someone's behalf.
 */
export function CopilotAttribution({
  helperName,
  forName,
  review,
  size = "normal",
}: {
  helperName: string;
  forName: string;
  review?: string | null;
  size?: "compact" | "normal";
}) {
  const c = useColors();
  const isFlagged = review === "flagged";
  const isPending = !review || review === "pending";

  const tone = isFlagged ? c.destructive ?? "#b91c1c" : c.primary;
  const bg = isFlagged
    ? "rgba(185, 28, 28, 0.08)"
    : isPending
    ? "rgba(0,0,0,0.04)"
    : c.primarySoft;

  return (
    <View
      style={{
        marginTop: size === "compact" ? 4 : 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: bg,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Feather
        name={isFlagged ? "flag" : "user-check"}
        size={12}
        color={tone}
      />
      <AppText variant="caption" color={tone} weight="medium">
        {helperName} posted for {forName}
        {isFlagged ? " · flagged" : isPending ? " · pending review" : ""}
      </AppText>
    </View>
  );
}
