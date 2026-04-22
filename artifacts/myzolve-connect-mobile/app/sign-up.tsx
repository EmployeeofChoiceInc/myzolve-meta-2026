import { useSignUp } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { AppText, Button, Field, Input } from "@/components/UI";
import { OAuthButtons } from "@/components/OAuthButtons";
import { useColors } from "@/hooks/useColors";

type ClerkApiError = {
  message?: string;
  longMessage?: string;
  code?: string;
};
type ClerkErrorLike = {
  errors?: ClerkApiError[];
  message?: string;
};

function describeError(err: unknown, fallback: string): string {
  const e = err as ClerkErrorLike | undefined;
  const first = e?.errors?.[0];
  return first?.longMessage ?? first?.message ?? e?.message ?? fallback;
}

export default function SignUpScreen() {
  const { signUp } = useSignUp();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"form" | "verify">("form");
  const [loading, setLoading] = useState(false);

  async function onCreate() {
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter an email and password.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp.password({
        emailAddress: email.trim(),
        password,
      });
      if (error) {
        Alert.alert("Couldn't sign up", describeError(error, "Please try again."));
        return;
      }
      await signUp.verifications.sendEmailCode();
      setStage("verify");
    } catch (err: unknown) {
      Alert.alert("Couldn't sign up", describeError(err, "Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function onVerify() {
    setLoading(true);
    try {
      await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace("/(tabs)");
          },
        });
      } else {
        Alert.alert("Verification incomplete", "Please try again.");
      }
    } catch (err: unknown) {
      Alert.alert("Couldn't verify", describeError(err, "Wrong code."));
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
            {/* Required for sign-up; Clerk's bot protection is on by default */}
            <View nativeID="clerk-captcha" />

            <OAuthButtons />
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
