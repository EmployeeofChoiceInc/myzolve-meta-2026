import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@clerk/expo";
import {
  getDiscoverCirclesQueryKey,
  getGetCircleQueryKey,
  getListCircleMembersQueryKey,
  getListCirclesQueryKey,
  useApplyForCircleVerification,
  useGetCircle,
  useListCircleMembers,
  useUpdateCircle,
  useUpdateCircleMember,
} from "@workspace/api-client-react";

import {
  AppText,
  Button,
  Field,
  IconButton,
  Input,
  Row,
  Skeleton,
} from "@/components/UI";
import { PaywallSheet } from "@/components/PaywallSheet";
import { PlusBadge } from "@/components/PlusBadge";
import { RolePickerSheet } from "@/components/RolePickerSheet";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useColors } from "@/hooks/useColors";
import { safeBack } from "@/lib/safeBack";
import {
  CIRCLE_ACCENT_PALETTE,
  MAX_WELCOME_MESSAGE_LEN,
} from "@/constants/circleLook";
import { useCircleBannerUpload, type LocalPostImage } from "@/lib/postApi";
import {
  type AssignableRole,
  type CircleRole,
  ROLE_LABELS,
  rolePillColors,
} from "@/lib/circleRoles";
import { useIsPlus } from "@/lib/revenuecat";

type PrivacyMode = "private" | "hidden" | "open" | "community";

const PRIVACY_OPTIONS: {
  value: PrivacyMode;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  {
    value: "private",
    label: "Private",
    description: "Invite only. Won't appear in Discover.",
    icon: "lock",
  },
  {
    value: "hidden",
    label: "Hidden",
    description: "Anyone with the link can join. Won't appear in Discover.",
    icon: "eye-off",
  },
  {
    value: "open",
    label: "Open",
    description: "Listed in Discover. Anyone can ask to join.",
    icon: "globe",
  },
  {
    value: "community",
    label: "Community",
    description:
      "Listed in Discover. Best for larger groups — admins review join requests.",
    icon: "users",
  },
];

export default function CircleSettingsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const qc = useQueryClient();

  const { data: circle, isLoading } = useGetCircle(circleId);
  const update = useUpdateCircle();
  const isOwner = circle?.myRole === "owner";
  const ownerHasPlus = useIsPlus();

  const { data: members } = useListCircleMembers(circleId);
  const updateMember = useUpdateCircleMember();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("private");
  const [hydrated, setHydrated] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  // Plus "Custom circle look" — banner / accent / welcome message.
  // null in state means "no value", which serializes to null on the
  // wire to clear server-side. undefined means "not changed".
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  // The pending banner object path is only set after a successful
  // upload — until the user hits Save we keep the prior value.
  const [pendingBannerPath, setPendingBannerPath] = useState<
    string | null | undefined
  >(undefined);
  const [bannerPreviewUri, setBannerPreviewUri] = useState<string | null>(null);
  const bannerUpload = useCircleBannerUpload(circleId);
  const { getToken } = useAuth();
  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getToken()
      .then((t) => alive && setAuthToken(t ?? null))
      .catch(() => alive && setAuthToken(null));
    return () => {
      alive = false;
    };
  }, [getToken]);
  const [pickerFor, setPickerFor] = useState<{
    memberId: number;
    name: string;
    role: string;
  } | null>(null);

  // ── Verified circle application ───────────────────────────────────────
  // Plus owners can apply to have their circle verified by the team. We
  // hide the form once an application has been submitted (pending) or
  // accepted (verified); rejected circles can re-apply with the form
  // pre-cleared.
  const applyForVerification = useApplyForCircleVerification();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [vLegalName, setVLegalName] = useState("");
  const [vOrgType, setVOrgType] = useState<
    "faith_group" | "mutual_aid" | "co_op" | "nonprofit" | "other"
  >("nonprofit");
  const [vDescription, setVDescription] = useState("");
  const [vContactEmail, setVContactEmail] = useState("");
  const [vSupportingUrl, setVSupportingUrl] = useState("");

  function submitVerification() {
    if (vLegalName.trim().length < 1) {
      Alert.alert("Add the org name", "Please share your organization's legal name.");
      return;
    }
    if (vDescription.trim().length < 10) {
      Alert.alert(
        "Tell us more",
        "A short description (at least a sentence) helps the reviewer.",
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vContactEmail.trim())) {
      Alert.alert("Contact email", "Please share a valid contact email.");
      return;
    }
    const trimmedUrl = vSupportingUrl.trim();
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      Alert.alert("Supporting URL", "Please paste a full URL starting with http or https.");
      return;
    }
    applyForVerification.mutate(
      {
        circleId,
        data: {
          legalName: vLegalName.trim(),
          orgType: vOrgType,
          description: vDescription.trim(),
          contactEmail: vContactEmail.trim(),
          supportingUrl: trimmedUrl ? trimmedUrl : null,
        },
      },
      {
        onSuccess: (updated) => {
          qc.setQueryData(getGetCircleQueryKey(circleId), updated);
          setVerifyOpen(false);
          Alert.alert(
            "Application sent",
            "Our team will take a look and get back to you. You'll get a notification when there's a decision.",
          );
        },
        onError: (err: unknown) => {
          const status =
            typeof err === "object" && err !== null && "status" in err
              ? (err as { status?: number }).status
              : undefined;
          if (status === 402) {
            setPaywallVisible(true);
            return;
          }
          if (status === 409) {
            qc.invalidateQueries({ queryKey: getGetCircleQueryKey(circleId) });
            Alert.alert(
              "Already submitted",
              "This circle already has an application in review.",
            );
            return;
          }
          Alert.alert("Couldn't send application", "Please try again in a moment.");
        },
      },
    );
  }

  useEffect(() => {
    if (circle && !hydrated) {
      setName(circle.name ?? "");
      setDescription(circle.description ?? "");
      setPrivacyMode((circle.privacyMode as PrivacyMode) ?? "private");
      setAccentColor(circle.accentColor ?? null);
      setWelcomeMessage(circle.welcomeMessage ?? "");
      setHydrated(true);
    }
  }, [circle, hydrated]);

  async function pickBanner() {
    if (!ownerHasPlus) {
      setPaywallVisible(true);
      return;
    }
    if (bannerUpload.isPending || update.isPending) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access in Settings to choose a banner.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [16, 9],
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      Alert.alert("Unsupported file", "Please pick an image.");
      return;
    }
    const file: LocalPostImage = {
      uri: asset.uri,
      name: asset.fileName ?? `banner.${contentType.split("/")[1] ?? "jpg"}`,
      size: asset.fileSize ?? 0,
      contentType,
    };
    setBannerPreviewUri(asset.uri);
    bannerUpload.mutate(file, {
      onSuccess: (objectPath) => {
        setPendingBannerPath(objectPath);
      },
      onError: (err: unknown) => {
        setBannerPreviewUri(null);
        const status =
          typeof err === "object" && err !== null && "status" in err
            ? (err as { status?: number }).status
            : undefined;
        if (status === 402) {
          setPaywallVisible(true);
          return;
        }
        Alert.alert("Couldn't upload", "Please try again in a moment.");
      },
    });
  }

  function clearBanner() {
    setPendingBannerPath(null);
    setBannerPreviewUri(null);
  }

  const isAdmin =
    circle?.myRole === "owner" || circle?.myRole === "admin";

  function openRolePicker(member: { id: number; displayName: string; role: string }) {
    setPickerFor({ memberId: member.id, name: member.displayName, role: member.role });
  }

  function pickRole(role: AssignableRole) {
    if (!pickerFor) return;
    const memberId = pickerFor.memberId;
    setPickerFor(null);
    updateMember.mutate(
      { circleId, memberId, data: { role } },
      {
        onSuccess: () => {
          qc.invalidateQueries({
            queryKey: getListCircleMembersQueryKey(circleId),
          });
        },
        onError: (err: unknown) => {
          // 402 from the API is the server's way of saying "open the paywall".
          // Anything else is a generic failure surface.
          const status =
            typeof err === "object" && err !== null && "status" in err
              ? (err as { status?: number }).status
              : undefined;
          if (status === 402) {
            setPaywallVisible(true);
            return;
          }
          Alert.alert("Couldn't update role", "Please try again in a moment.");
        },
      },
    );
  }

  function submit() {
    if (name.trim().length < 1) {
      Alert.alert("Add a name", "Your circle needs a name.");
      return;
    }
    if (welcomeMessage.length > MAX_WELCOME_MESSAGE_LEN) {
      Alert.alert(
        "Welcome message too long",
        `Please keep it under ${MAX_WELCOME_MESSAGE_LEN} characters.`,
      );
      return;
    }
    // Build a delta payload for the Plus look fields. Only Plus owners
    // are allowed to *set* values; everyone (well, the owner) can clear.
    type LookPatch = {
      bannerObjectPath?: string | null;
      accentColor?: string | null;
      welcomeMessage?: string | null;
    };
    const lookPatch: LookPatch = {};
    if (isOwner) {
      if (pendingBannerPath !== undefined) {
        lookPatch.bannerObjectPath = pendingBannerPath;
      }
      const currentAccent = circle?.accentColor ?? null;
      if (accentColor !== currentAccent) {
        lookPatch.accentColor = accentColor;
      }
      const currentWelcome = circle?.welcomeMessage ?? "";
      const trimmedWelcome = welcomeMessage.trim();
      if (trimmedWelcome !== currentWelcome) {
        lookPatch.welcomeMessage = trimmedWelcome === "" ? null : trimmedWelcome;
      }
    }

    update.mutate(
      {
        circleId,
        data: {
          name: name.trim(),
          description: description.trim(),
          privacyMode,
          ...lookPatch,
        },
      },
      {
        onSuccess: (updated) => {
          qc.setQueryData(getGetCircleQueryKey(circleId), updated);
          qc.invalidateQueries({ queryKey: getGetCircleQueryKey(circleId) });
          qc.invalidateQueries({ queryKey: getListCirclesQueryKey() });
          qc.invalidateQueries({ queryKey: getDiscoverCirclesQueryKey() });
          safeBack(router);
        },
        onError: (err: unknown) => {
          const status =
            typeof err === "object" && err !== null && "status" in err
              ? (err as { status?: number }).status
              : undefined;
          if (status === 402) {
            setPaywallVisible(true);
            return;
          }
          Alert.alert("Couldn't save", "Please try again in a moment.");
        },
      }
    );
  }

  // Construct the URL for the persisted banner so we can show what's
  // currently set even before a new file is picked. Falls back to the
  // local preview while the upload is in flight.
  const persistedBannerObjectPath =
    pendingBannerPath !== undefined ? pendingBannerPath : circle?.bannerObjectPath ?? null;
  const persistedBannerUri = (() => {
    if (!persistedBannerObjectPath) return null;
    const base = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "";
    const stripped = persistedBannerObjectPath.startsWith("/objects/")
      ? persistedBannerObjectPath.slice("/objects/".length)
      : persistedBannerObjectPath;
    return `${base}/api/storage/user-media/${stripped}`;
  })();
  const bannerDisplayUri = bannerPreviewUri ?? persistedBannerUri;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Row
          justify="space-between"
          align="center"
          style={{
            paddingHorizontal: 16,
            paddingTop: insets.top + 12,
            paddingBottom: 8,
          }}
        >
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
          <AppText weight="semibold">Circle Settings</AppText>
          <View style={{ width: 40 }} />
        </Row>

        <KeyboardAwareScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 40,
          }}
          bottomOffset={60}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading || !circle ? (
            <Skeleton height={200} />
          ) : !isAdmin ? (
            <View
              style={{
                backgroundColor: c.card,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 16,
                padding: 20,
                alignItems: "center",
              }}
            >
              <Feather name="lock" size={28} color={c.mutedForeground} />
              <AppText
                weight="semibold"
                style={{ marginTop: 10, textAlign: "center" }}
              >
                Admins only
              </AppText>
              <AppText
                color={c.mutedForeground}
                style={{ marginTop: 6, textAlign: "center" }}
              >
                Only the circle&apos;s owner or admins can change these settings.
              </AppText>
            </View>
          ) : (
            <>
              <AppText
                color={c.mutedForeground}
                style={{ marginBottom: 20 }}
              >
                Update your circle&apos;s name, description, and who can find it.
              </AppText>

              <Field label="Circle name">
                <Input
                  value={name}
                  onChangeText={setName}
                  placeholder="Our Family Circle"
                  testID="input-circle-name"
                />
              </Field>

              <Field label="Description (optional)">
                <Input
                  value={description}
                  onChangeText={setDescription}
                  placeholder="A brief description of your circle…"
                  multiline
                  style={{ minHeight: 90, textAlignVertical: "top" }}
                  testID="input-circle-description"
                />
              </Field>

              <Field label="Visibility">
                <AppText
                  variant="caption"
                  color={c.mutedForeground}
                  style={{ marginTop: -6, marginBottom: 10 }}
                >
                  Open and Community circles show up under Profile → Discover so
                  others can find them.
                </AppText>
                <View style={{ gap: 10 }}>
                  {PRIVACY_OPTIONS.map((opt) => {
                    const active = privacyMode === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setPrivacyMode(opt.value)}
                        testID={`privacy-${opt.value}`}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 14,
                          padding: 14,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: active ? c.primary : c.border,
                          backgroundColor: active ? c.primarySoft : c.card,
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: active ? c.primary : c.muted,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather
                            name={opt.icon}
                            size={18}
                            color={active ? "#fff" : c.foreground}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText weight="semibold">{opt.label}</AppText>
                          <AppText
                            variant="caption"
                            color={c.mutedForeground}
                            style={{ marginTop: 2 }}
                          >
                            {opt.description}
                          </AppText>
                        </View>
                        {active && (
                          <Feather
                            name="check-circle"
                            size={20}
                            color={c.primary}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              {isOwner ? (
                <View style={{ marginTop: 8, marginBottom: 16 }}>
                  <Row align="center" gap={8} style={{ marginBottom: 4 }}>
                    <AppText weight="semibold">Look &amp; feel</AppText>
                    <PlusBadge size="sm" variant="soft" />
                  </Row>
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginBottom: 12, lineHeight: 18 }}
                  >
                    With Plus you can give your circle its own banner,
                    accent color, and welcome note for new members.
                  </AppText>

                  {!ownerHasPlus ? (
                    <>
                      <Pressable
                        onPress={() => setPaywallVisible(true)}
                        testID="look-feel-upsell"
                        style={({ pressed }) => ({
                          backgroundColor: c.primarySoft,
                          borderColor: c.primary,
                          borderWidth: 1,
                          borderRadius: 14,
                          padding: 14,
                          marginBottom: 12,
                          opacity: pressed ? 0.92 : 1,
                        })}
                      >
                        <Row align="center" justify="space-between">
                          <View style={{ flex: 1, paddingRight: 12 }}>
                            <AppText weight="semibold" color={c.primary}>
                              Customize your circle with Plus
                            </AppText>
                            <AppText
                              variant="caption"
                              color={c.foreground}
                              style={{ marginTop: 2 }}
                            >
                              Tap to learn more about Plus.
                            </AppText>
                          </View>
                          <Feather name="chevron-right" size={20} color={c.primary} />
                        </Row>
                      </Pressable>
                      {circle?.bannerObjectPath ||
                      circle?.accentColor ||
                      circle?.welcomeMessage ? (
                        <View style={{ marginBottom: 12 }}>
                          <Button
                            title="Reset to default look"
                            variant="outline"
                            testID="look-feel-reset"
                            loading={update.isPending}
                            onPress={() => {
                              update.mutate(
                                {
                                  circleId,
                                  data: {
                                    bannerObjectPath: null,
                                    accentColor: null,
                                    welcomeMessage: null,
                                  },
                                },
                                {
                                  onSuccess: () => {
                                    setBannerPreviewUri(null);
                                    setPendingBannerPath(undefined);
                                    setAccentColor(null);
                                    setWelcomeMessage("");
                                    qc.invalidateQueries({
                                      queryKey: getGetCircleQueryKey(circleId),
                                    });
                                  },
                                },
                              );
                            }}
                          />
                          <AppText
                            variant="caption"
                            color={c.mutedForeground}
                            style={{ marginTop: 6, lineHeight: 18 }}
                          >
                            Clears the banner, accent color and welcome
                            message. You can keep using your circle without
                            Plus.
                          </AppText>
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  <View
                    style={{ opacity: ownerHasPlus ? 1 : 0.5 }}
                    pointerEvents={ownerHasPlus ? "auto" : "none"}
                  >
                    <Field label="Banner image">
                      {bannerDisplayUri && authToken ? (
                        <View
                          style={{
                            height: 120,
                            borderRadius: 14,
                            overflow: "hidden",
                            marginBottom: 8,
                            backgroundColor: c.muted,
                          }}
                        >
                          {(() => {
                            // eslint-disable-next-line @typescript-eslint/no-require-imports
                            const { Image } = require("expo-image") as typeof import("expo-image");
                            // For local previews from the picker we don't
                            // need an Authorization header — the URI is a
                            // file:// path. For remote (already-uploaded)
                            // banners we attach the bearer.
                            const isLocal = bannerDisplayUri.startsWith("file:") ||
                              bannerDisplayUri.startsWith("data:") ||
                              bannerDisplayUri.startsWith("ph://") ||
                              bannerDisplayUri.startsWith("assets-library:");
                            return (
                              <Image
                                source={
                                  isLocal
                                    ? { uri: bannerDisplayUri }
                                    : {
                                        uri: bannerDisplayUri,
                                        headers: {
                                          Authorization: `Bearer ${authToken}`,
                                        },
                                      }
                                }
                                style={{ width: "100%", height: "100%" }}
                                contentFit="cover"
                                testID="banner-preview"
                              />
                            );
                          })()}
                        </View>
                      ) : null}
                      <Row gap={8}>
                        <View style={{ flex: 1 }}>
                          <Button
                            title={
                              bannerUpload.isPending
                                ? "Uploading…"
                                : bannerDisplayUri
                                  ? "Change banner"
                                  : "Pick a banner"
                            }
                            onPress={pickBanner}
                            loading={bannerUpload.isPending}
                            icon="image"
                            variant="secondary"
                            testID="button-pick-banner"
                          />
                        </View>
                        {bannerDisplayUri ? (
                          <IconButton
                            icon="trash-2"
                            onPress={clearBanner}
                            testID="button-clear-banner"
                          />
                        ) : null}
                      </Row>
                    </Field>

                    <Field label="Accent color">
                      <Row gap={10} style={{ flexWrap: "wrap" }}>
                        {CIRCLE_ACCENT_PALETTE.map((swatch) => {
                          const active = accentColor === swatch.hex;
                          return (
                            <Pressable
                              key={swatch.hex}
                              onPress={() =>
                                setAccentColor(active ? null : swatch.hex)
                              }
                              testID={`accent-${swatch.hex}`}
                              accessibilityLabel={swatch.label}
                              style={({ pressed }) => ({
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: swatch.hex,
                                borderWidth: active ? 3 : 1,
                                borderColor: active ? c.foreground : c.border,
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: pressed ? 0.85 : 1,
                              })}
                            >
                              {active ? (
                                <Feather name="check" size={18} color="#fff" />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </Row>
                      <AppText
                        variant="caption"
                        color={c.mutedForeground}
                        style={{ marginTop: 8 }}
                      >
                        {accentColor ? "Tap again to use the default." : "Pick a swatch to tint headings, badges, and buttons."}
                      </AppText>
                    </Field>

                    <Field label="Welcome message">
                      <Input
                        value={welcomeMessage}
                        onChangeText={(t) =>
                          setWelcomeMessage(t.slice(0, MAX_WELCOME_MESSAGE_LEN))
                        }
                        placeholder="A short hello shown to new members…"
                        multiline
                        style={{ minHeight: 90, textAlignVertical: "top" }}
                        testID="input-welcome-message"
                      />
                      <AppText
                        variant="caption"
                        color={c.mutedForeground}
                        style={{ marginTop: 4, textAlign: "right" }}
                      >
                        {welcomeMessage.length}/{MAX_WELCOME_MESSAGE_LEN}
                      </AppText>
                    </Field>
                  </View>
                </View>
              ) : null}

              <Button
                title="Save changes"
                onPress={submit}
                loading={update.isPending}
                icon="check"
                testID="button-save-settings"
                style={{ marginTop: 8 }}
              />

              {isOwner ? (
                <View style={{ marginTop: 32 }}>
                  <Row align="center" gap={8} style={{ marginBottom: 4 }}>
                    <AppText weight="semibold">Trust</AppText>
                    <PlusBadge size="sm" variant="soft" />
                  </Row>
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginBottom: 12, lineHeight: 18 }}
                  >
                    If your circle represents a real-world organization — a
                    mosque mutual aid group, a recovery community, a co-op —
                    apply for the Verified badge. Our team reviews each one.
                  </AppText>

                  {circle.verificationStatus === "verified" ? (
                    <View
                      testID="verification-status-verified"
                      style={{
                        backgroundColor: c.card,
                        borderColor: c.border,
                        borderWidth: 1,
                        borderRadius: 14,
                        padding: 14,
                      }}
                    >
                      <Row align="center" gap={10}>
                        <VerifiedBadge size="md" />
                        <View style={{ flex: 1 }}>
                          <AppText weight="semibold">This circle is verified</AppText>
                          <AppText
                            variant="caption"
                            color={c.mutedForeground}
                            style={{ marginTop: 2 }}
                          >
                            The Verified badge shows next to your circle name everywhere.
                          </AppText>
                        </View>
                      </Row>
                    </View>
                  ) : circle.verificationStatus === "pending" ? (
                    <View
                      testID="verification-status-pending"
                      style={{
                        backgroundColor: c.card,
                        borderColor: c.border,
                        borderWidth: 1,
                        borderRadius: 14,
                        padding: 14,
                      }}
                    >
                      <Row align="center" gap={10}>
                        <Feather name="clock" size={18} color={c.mutedForeground} />
                        <View style={{ flex: 1 }}>
                          <AppText weight="semibold">Application in review</AppText>
                          <AppText
                            variant="caption"
                            color={c.mutedForeground}
                            style={{ marginTop: 2 }}
                          >
                            We&apos;ll send a notification when there&apos;s a decision.
                          </AppText>
                        </View>
                      </Row>
                    </View>
                  ) : !ownerHasPlus ? (
                    <Pressable
                      onPress={() => setPaywallVisible(true)}
                      testID="verification-upsell"
                      style={({ pressed }) => ({
                        backgroundColor: c.primarySoft,
                        borderColor: c.primary,
                        borderWidth: 1,
                        borderRadius: 14,
                        padding: 14,
                        opacity: pressed ? 0.92 : 1,
                      })}
                    >
                      <Row align="center" justify="space-between">
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <AppText weight="semibold" color={c.primary}>
                            Apply for Verified with Plus
                          </AppText>
                          <AppText
                            variant="caption"
                            color={c.foreground}
                            style={{ marginTop: 2 }}
                          >
                            Tap to learn more about Plus.
                          </AppText>
                        </View>
                        <Feather name="chevron-right" size={20} color={c.primary} />
                      </Row>
                    </Pressable>
                  ) : (
                    <>
                      {circle.verificationStatus === "rejected" &&
                      circle.verificationDecisionReason ? (
                        <View
                          testID="verification-status-rejected"
                          style={{
                            backgroundColor: c.card,
                            borderColor: c.border,
                            borderWidth: 1,
                            borderRadius: 14,
                            padding: 14,
                            marginBottom: 12,
                          }}
                        >
                          <Row align="flex-start" gap={10}>
                            <Feather
                              name="alert-circle"
                              size={18}
                              color={c.mutedForeground}
                            />
                            <View style={{ flex: 1 }}>
                              <AppText weight="semibold">
                                Application declined
                              </AppText>
                              <AppText
                                variant="caption"
                                color={c.mutedForeground}
                                style={{ marginTop: 4, lineHeight: 18 }}
                              >
                                {circle.verificationDecisionReason}
                              </AppText>
                              <AppText
                                variant="caption"
                                color={c.mutedForeground}
                                style={{ marginTop: 6, lineHeight: 18 }}
                              >
                                You can address the feedback and apply again.
                              </AppText>
                            </View>
                          </Row>
                        </View>
                      ) : null}

                      {!verifyOpen ? (
                        <Button
                          title={
                            circle.verificationStatus === "rejected"
                              ? "Apply again"
                              : "Apply for Verified"
                          }
                          icon="check-circle"
                          variant="secondary"
                          testID="button-apply-verification"
                          onPress={() => setVerifyOpen(true)}
                        />
                      ) : (
                        <View
                          style={{
                            backgroundColor: c.card,
                            borderColor: c.border,
                            borderWidth: 1,
                            borderRadius: 14,
                            padding: 14,
                          }}
                        >
                          <Field label="Legal name of the organization">
                            <Input
                              value={vLegalName}
                              onChangeText={setVLegalName}
                              placeholder="e.g. Ridgeway Community Mutual Aid"
                              testID="input-verify-legal-name"
                            />
                          </Field>
                          <Field label="Type">
                            <View
                              style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              {(
                                [
                                  ["faith_group", "Faith group"],
                                  ["mutual_aid", "Mutual aid"],
                                  ["co_op", "Co-op"],
                                  ["nonprofit", "Nonprofit"],
                                  ["other", "Other"],
                                ] as const
                              ).map(([value, label]) => {
                                const active = vOrgType === value;
                                return (
                                  <Pressable
                                    key={value}
                                    onPress={() => setVOrgType(value)}
                                    testID={`verify-orgtype-${value}`}
                                    style={{
                                      paddingHorizontal: 14,
                                      paddingVertical: 8,
                                      borderRadius: 999,
                                      backgroundColor: active
                                        ? c.primary
                                        : c.muted,
                                    }}
                                  >
                                    <AppText
                                      variant="caption"
                                      weight="medium"
                                      color={active ? "#fff" : c.foreground}
                                    >
                                      {label}
                                    </AppText>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </Field>
                          <Field label="Description">
                            <Input
                              value={vDescription}
                              onChangeText={setVDescription}
                              placeholder="What does this organization do?"
                              multiline
                              style={{ minHeight: 90, textAlignVertical: "top" }}
                              testID="input-verify-description"
                            />
                          </Field>
                          <Field label="Contact email">
                            <Input
                              value={vContactEmail}
                              onChangeText={setVContactEmail}
                              placeholder="someone@yourorg.org"
                              keyboardType="email-address"
                              autoCapitalize="none"
                              testID="input-verify-contact-email"
                            />
                          </Field>
                          <Field label="Supporting URL or document (optional)">
                            <Input
                              value={vSupportingUrl}
                              onChangeText={setVSupportingUrl}
                              placeholder="https://yourorg.org"
                              autoCapitalize="none"
                              testID="input-verify-supporting-url"
                            />
                          </Field>
                          <Row gap={8}>
                            <View style={{ flex: 1 }}>
                              <Button
                                title="Submit"
                                onPress={submitVerification}
                                loading={applyForVerification.isPending}
                                testID="button-submit-verification"
                              />
                            </View>
                            <Button
                              title="Cancel"
                              variant="ghost"
                              onPress={() => setVerifyOpen(false)}
                            />
                          </Row>
                        </View>
                      )}
                    </>
                  )}
                </View>
              ) : null}

              {isOwner ? (
                <View style={{ marginTop: 32 }}>
                  <Row align="center" gap={8} style={{ marginBottom: 4 }}>
                    <AppText weight="semibold">Roles</AppText>
                    <PlusBadge size="sm" variant="soft" />
                  </Row>
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginBottom: 12, lineHeight: 18 }}
                  >
                    With Plus you can delegate parts of running your circle —
                    a host to handle members, a treasurer for the ledger, a
                    scribe for the wall.
                  </AppText>
                  {!ownerHasPlus ? (
                    <Pressable
                      onPress={() => setPaywallVisible(true)}
                      testID="roles-upsell"
                      style={({ pressed }) => ({
                        backgroundColor: c.primarySoft,
                        borderColor: c.primary,
                        borderWidth: 1,
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 12,
                        opacity: pressed ? 0.92 : 1,
                      })}
                    >
                      <Row align="center" justify="space-between">
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <AppText weight="semibold" color={c.primary}>
                            Unlock sub-roles with Plus
                          </AppText>
                          <AppText
                            variant="caption"
                            color={c.foreground}
                            style={{ marginTop: 2 }}
                          >
                            Tap to learn more about delegating with Plus.
                          </AppText>
                        </View>
                        <Feather name="chevron-right" size={20} color={c.primary} />
                      </Row>
                    </Pressable>
                  ) : null}
                  {/*
                    Role assignment is a Plus-only feature, so the interactive
                    list is hidden entirely from non-Plus owners. They see the
                    upsell card above instead — this keeps the gating obvious
                    and avoids dead taps that just bounce to the paywall.
                  */}
                  <View style={{ gap: 8, opacity: ownerHasPlus ? 1 : 0.5 }} pointerEvents={ownerHasPlus ? "auto" : "none"}>
                    {(members ?? [])
                      .filter((m) => m.status === "active" && m.role !== "owner")
                      .map((m) => {
                        const pill = rolePillColors(m.role, c);
                        return (
                          <Pressable
                            key={m.id}
                            onPress={() => openRolePicker(m)}
                            testID={`role-row-${m.id}`}
                            style={({ pressed }) => ({
                              backgroundColor: c.card,
                              borderColor: c.border,
                              borderWidth: 1,
                              borderRadius: 14,
                              padding: 12,
                              opacity: pressed ? 0.9 : 1,
                            })}
                          >
                            <Row align="center" justify="space-between">
                              <View style={{ flex: 1, paddingRight: 12 }}>
                                <AppText weight="semibold">
                                  {m.displayName}
                                </AppText>
                                <AppText
                                  variant="caption"
                                  color={c.mutedForeground}
                                  style={{ marginTop: 2 }}
                                >
                                  {m.email ?? ""}
                                </AppText>
                              </View>
                              <View
                                style={{
                                  backgroundColor: pill.bg,
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 999,
                                  marginRight: 6,
                                }}
                              >
                                <AppText
                                  variant="caption"
                                  weight="semibold"
                                  color={pill.fg}
                                >
                                  {ROLE_LABELS[m.role as CircleRole] ?? m.role}
                                </AppText>
                              </View>
                              <Feather
                                name="chevron-right"
                                size={18}
                                color={c.mutedForeground}
                              />
                            </Row>
                          </Pressable>
                        );
                      })}
                    {members && members.filter((m) => m.status === "active" && m.role !== "owner").length === 0 ? (
                      <AppText
                        variant="caption"
                        color={c.mutedForeground}
                        style={{ marginTop: 4 }}
                      >
                        Invite people to your circle, then come back here to
                        give them a role.
                      </AppText>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </KeyboardAwareScrollView>
      </View>
      {pickerFor ? (
        <RolePickerSheet
          visible={!!pickerFor}
          memberName={pickerFor.name}
          currentRole={pickerFor.role}
          ownerHasPlus={ownerHasPlus}
          onClose={() => setPickerFor(null)}
          onPick={pickRole}
          onRequestPlus={() => {
            setPickerFor(null);
            setPaywallVisible(true);
          }}
        />
      ) : null}
      <PaywallSheet
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </>
  );
}
