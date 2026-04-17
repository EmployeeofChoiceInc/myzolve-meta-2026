import { useSignUp } from "@clerk/clerk-expo";
import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { AppText, Button, Field, Input } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"form" | "verify">("form");
  const [loading, setLoading] = useState(false);

  async function onCreate() {
    if (!isLoaded) return;
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter an email and password.");
      return;
    }
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStage("verify");
    } catch (err: unknown) {
      const e = err as { errors?: { message?: string }[]; message?: string };
      Alert.alert(
        "Couldn't sign up",
        e.errors?.[0]?.message ?? e.message ?? "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function onVerify() {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        Alert.alert("Verification incomplete", "Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { errors?: { message?: string }[]; message?: string };
      Alert.alert("Couldn't verify", e.errors?.[0]?.message ?? e.message ?? "Wrong code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      <Pressable
        onPress={() => router.back()}
        style={{ padding: 16, alignSelf: "flex-end" }}
      >
        <Feather name="x" size={24} color={c.foreground} />
      </Pressable>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 8 }}
        bottomOffset={40}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: c.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Feather name="users" size={26} color={c.primary} />
        </View>
        <AppText variant="h1">{stage === "form" ? "Join your circle" : "Confirm your email"}</AppText>
        <AppText variant="body" color={c.mutedForeground} style={{ marginTop: 6, marginBottom: 28 }}>
          {stage === "form"
            ? "A warm space for the people you trust most."
            : `We sent a code to ${email}.`}
        </AppText>

        {stage === "form" ? (
          <>
            <Field label="Email">
              <Input
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                testID="input-email"
              />
            </Field>
            <Field label="Password">
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="At least 8 characters"
                testID="input-password"
              />
            </Field>
            <Button title="Create account" onPress={onCreate} loading={loading} testID="button-signup" />
          </>
        ) : (
          <>
            <Field label="Verification code">
              <Input
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="123456"
                testID="input-code"
              />
            </Field>
            <Button title="Verify and continue" onPress={onVerify} loading={loading} testID="button-verify" />
          </>
        )}

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <AppText color={c.mutedForeground}>Already have an account? </AppText>
          <Link href="/sign-in" replace>
            <AppText color={c.primary} weight="semibold">Sign in</AppText>
          </Link>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
