import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  customFetch,
  getGetMeQueryKey,
  useGetMe,
} from "@workspace/api-client-react";

import {
  AppText,
  Avatar,
  Button,
  Field,
  IconButton,
  Input,
  Row,
} from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { safeBack } from "@/lib/safeBack";
import {
  MAX_AVATAR_BYTES,
  useAvatarUpload,
  type LocalAvatarImage,
} from "@/lib/postApi";

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
];

type ProfileUpdatePayload = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  timezone?: string;
  bio?: string;
  location?: string;
  pronouns?: string;
  phone?: string;
  phoneDiscoverable?: boolean;
  profileShowCirclesDefault?: boolean;
};

type MeResponse = {
  id: number;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  timezone?: string | null;
  bio?: string | null;
  location?: string | null;
  avatarObjectPath?: string | null;
  pronouns?: string | null;
  phone?: string | null;
  phoneDiscoverable?: boolean;
  profileShowCirclesDefault?: boolean;
};

function inferContentType(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const ext = (asset.fileName ?? asset.uri).split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return "image/jpeg";
  }
}

function inferFileName(asset: ImagePicker.ImagePickerAsset, contentType: string): string {
  if (asset.fileName) return asset.fileName;
  const extFromType = contentType.split("/")[1] ?? "jpg";
  const tail = asset.uri.split("/").pop() ?? `avatar.${extFromType}`;
  return tail.includes(".") ? tail : `${tail}.${extFromType}`;
}

export default function EditProfileScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me, isLoading } = useGetMe();
  const avatarUpload = useAvatarUpload();
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneDiscoverable, setPhoneDiscoverable] = useState(false);
  const [profileShowCirclesDefault, setProfileShowCirclesDefault] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (me && !initialized) {
      const m = me as MeResponse;
      setFirstName(me.firstName ?? "");
      setLastName(me.lastName ?? "");
      setDisplayName(me.displayName ?? "");
      setTimezone(me.timezone ?? "UTC");
      setBio(m.bio ?? "");
      setLocation(m.location ?? "");
      setPronouns(m.pronouns ?? "");
      setPhone(m.phone ?? "");
      setPhoneDiscoverable(!!m.phoneDiscoverable);
      setProfileShowCirclesDefault(m.profileShowCirclesDefault ?? true);
      setInitialized(true);
    }
  }, [me, initialized]);

  const updateMe = useMutation({
    mutationFn: (data: ProfileUpdatePayload & { avatarObjectPath?: string }) =>
      customFetch<MeResponse>("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(getGetMeQueryKey(), updated);
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
  });

  async function pickAvatar() {
    if (avatarUpload.isPending || updateMe.isPending) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access in Settings to change your photo.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const contentType = inferContentType(asset);
    if (!contentType.startsWith("image/")) {
      Alert.alert("Unsupported file", "Please pick an image.");
      return;
    }
    const size = asset.fileSize ?? 0;
    if (size && size > MAX_AVATAR_BYTES) {
      Alert.alert("Image too large", "Profile photos must be 5 MB or smaller.");
      return;
    }
    const file: LocalAvatarImage = {
      uri: asset.uri,
      name: inferFileName(asset, contentType),
      size,
      contentType,
    };
    setAvatarPreviewUri(asset.uri);
    avatarUpload.mutate(file, {
      onSuccess: (objectPath) => {
        updateMe.mutate(
          { avatarObjectPath: objectPath },
          {
            onError: () => {
              setAvatarPreviewUri(null);
              Alert.alert("Couldn't save", "Photo upload failed. Please try again.");
            },
          },
        );
      },
      onError: (err: unknown) => {
        setAvatarPreviewUri(null);
        const msg = err instanceof Error ? err.message : "Please try again.";
        Alert.alert("Couldn't upload photo", msg);
      },
    });
  }

  function submit() {
    const trimmedDisplay = displayName.trim();
    if (trimmedDisplay.length < 2) {
      Alert.alert(
        "Display name too short",
        "Your display name must be at least 2 characters."
      );
      return;
    }
    const payload: ProfileUpdatePayload = {
      displayName: trimmedDisplay,
      timezone,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      bio: bio.trim() || undefined,
      location: location.trim() || undefined,
      pronouns: pronouns.trim() || undefined,
      phone: phone.trim() || undefined,
      phoneDiscoverable,
      profileShowCirclesDefault,
    };
    updateMe.mutate(payload, {
      onSuccess: () => {
        Alert.alert("Profile updated", "Your changes have been saved.", [
          { text: "OK", onPress: () => safeBack(router) },
        ]);
      },
      onError: () => {
        Alert.alert("Couldn't save", "Please try again in a moment.");
      },
    });
  }

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
          <AppText weight="semibold">Edit profile</AppText>
          <View style={{ width: 40 }} />
        </Row>

        <KeyboardAwareScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 40,
          }}
          bottomOffset={40}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading && !initialized ? (
            <AppText color={c.mutedForeground}>Loading…</AppText>
          ) : (
            <>
              <View style={{ alignItems: "center", marginBottom: 24 }}>
                <Pressable
                  onPress={pickAvatar}
                  testID="button-pick-avatar"
                  disabled={avatarUpload.isPending || updateMe.isPending}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.85 : 1,
                    position: "relative",
                  })}
                >
                  <Avatar
                    name={me?.displayName}
                    uri={avatarPreviewUri}
                    objectPath={avatarPreviewUri ? null : (me as MeResponse | undefined)?.avatarObjectPath}
                    size={96}
                  />
                  <View
                    style={{
                      position: "absolute",
                      right: 0,
                      bottom: 0,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: c.primary,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: c.background,
                    }}
                  >
                    <Feather name="camera" size={16} color={c.primaryForeground} />
                  </View>
                  {avatarUpload.isPending ? (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: 96,
                        height: 96,
                        borderRadius: 48,
                        backgroundColor: "rgba(0,0,0,0.4)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ActivityIndicator color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
                <AppText
                  color={c.mutedForeground}
                  style={{ marginTop: 10, fontSize: 13 }}
                >
                  Tap to change your photo
                </AppText>
              </View>

              <Field label="Display name">
                <Input
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="How others see you"
                  testID="input-display-name"
                />
              </Field>

              <Field label="First name (optional)">
                <Input
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Jane"
                  testID="input-first-name"
                />
              </Field>

              <Field label="Last name (optional)">
                <Input
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Doe"
                  testID="input-last-name"
                />
              </Field>

              <Field label="Timezone">
                <View style={{ gap: 8 }}>
                  {TIMEZONES.map((tz) => {
                    const active = timezone === tz.value;
                    return (
                      <Pressable
                        key={tz.value}
                        onPress={() => setTimezone(tz.value)}
                        testID={`timezone-${tz.value}`}
                        style={({ pressed }) => ({
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: active ? c.primary : c.border,
                          backgroundColor: active ? c.primarySoft : c.card,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          opacity: pressed ? 0.85 : 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        })}
                      >
                        <AppText
                          weight={active ? "semibold" : "regular"}
                          color={active ? c.primary : c.foreground}
                        >
                          {tz.label}
                        </AppText>
                        {active ? (
                          <Feather name="check" size={16} color={c.primary} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Bio (optional)">
                <Input
                  value={bio}
                  onChangeText={setBio}
                  placeholder="A little about yourself…"
                  multiline
                  maxLength={500}
                  style={{ minHeight: 96, textAlignVertical: "top" }}
                  testID="input-bio"
                />
              </Field>

              <Field label="Location (optional)">
                <Input
                  value={location}
                  onChangeText={setLocation}
                  placeholder="City, Country"
                  maxLength={200}
                  testID="input-location"
                />
              </Field>

              <Field label="Pronouns (optional)">
                <Input
                  value={pronouns}
                  onChangeText={setPronouns}
                  placeholder="she/her, he/him, they/them…"
                  maxLength={50}
                  testID="input-pronouns"
                />
              </Field>

              <Field label="Phone number (optional)">
                <Input
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 555 123 4567"
                  keyboardType="phone-pad"
                  maxLength={32}
                  testID="input-phone"
                />
                <AppText
                  variant="caption"
                  color={c.mutedForeground}
                  style={{ marginTop: 6 }}
                >
                  We never share your phone number. It's only used if you choose to be findable by it below.
                </AppText>
              </Field>

              <Pressable
                onPress={() => setPhoneDiscoverable((v) => !v)}
                testID="row-phone-discoverable"
                style={({ pressed }) => ({
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 14,
                  marginBottom: 16,
                  opacity: pressed ? 0.85 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                })}
              >
                <View style={{ flex: 1 }}>
                  <AppText weight="medium">Let people find me by my phone</AppText>
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginTop: 2 }}
                  >
                    When on, others can search for you using your exact phone number.
                  </AppText>
                </View>
                <Switch
                  value={phoneDiscoverable}
                  onValueChange={setPhoneDiscoverable}
                  trackColor={{ true: c.primary, false: c.muted }}
                  testID="switch-phone-discoverable"
                />
              </Pressable>

              <Pressable
                onPress={() => setProfileShowCirclesDefault((v) => !v)}
                testID="row-profile-show-circles-default"
                style={({ pressed }) => ({
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 14,
                  marginBottom: 16,
                  opacity: pressed ? 0.85 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                })}
              >
                <View style={{ flex: 1 }}>
                  <AppText weight="medium">Show my circles on my profile</AppText>
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginTop: 2 }}
                  >
                    Default for new circles. You can fine-tune each circle in Settings.
                  </AppText>
                </View>
                <Switch
                  value={profileShowCirclesDefault}
                  onValueChange={setProfileShowCirclesDefault}
                  trackColor={{ true: c.primary, false: c.muted }}
                  testID="switch-profile-show-circles-default"
                />
              </Pressable>

              <Button
                title="Save changes"
                icon="check"
                onPress={submit}
                loading={updateMe.isPending}
                testID="button-save-profile"
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}
