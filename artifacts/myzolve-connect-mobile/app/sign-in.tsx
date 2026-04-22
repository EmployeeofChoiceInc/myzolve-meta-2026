import { useSignIn } from "@clerk/expo";
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

export default function SignInScreen() {
  const { signIn } = useSignIn();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await signIn.password({
        emailAddress: email.trim(),
        password,
      });

      if (error) {
        // Common case for users who signed up with Google / Apple on web —
        // their account has no password, so the password strategy is "not
        // valid" for the account. Steer them toward the OAuth buttons.
        const code = (error as { errors?: { code?: string }[] })?.errors?.[0]?.code;
        const msg = describeError(error, "Please check your credentials.");
        const looksLikeNoPassword =
          code === "strategy_for_user_invalid" ||
          /verification strategy is not valid/i.test(msg);
        Alert.alert(
          "Couldn't sign in",
          looksLikeNoPassword
            ? "This account doesn't have a password set. Try \"Continue with Google\" or \"Continue with Apple\" below, or reset your password on the web."
            : msg
        );
        return;
      }

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) {
              // Pending session task (e.g. accept org invite). Stay put;
              // app will route on next render.
              return;
            }
            router.replace("/(tabs)");
          },
        });
      } else if (signIn.status === "needs_second_factor") {
        Alert.alert(
          "Two-factor required",
          "Two-factor authentication is required for this account, but isn't supported in the app yet. Please sign in on the web."
        );
      } else {
        Alert.alert(
          "Couldn't sign in",
          `Sign-in incomplete (status: ${signIn.status ?? "unknown"}). Please try again.`
        );
      }
    } catch (err: unknown) {
      Alert.alert(
        "Couldn't sign in",
        describeError(err, "Please check your credentials.")
      );
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
          <Feather name="heart" size={26} color={c.primary} />
        </View>
        <AppText variant="h1">Welcome back</AppText>
        <AppText variant="body" color={c.mutedForeground} style={{ marginTop: 6, marginBottom: 28 }}>
          Sign in to your trusted circles.
        </AppText>

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
            placeholder="••••••••"
            testID="input-password"
          />
        </Field>

        <Button title="Sign in" onPress={onSubmit} loading={loading} testID="button-signin" />

        <OAuthButtons />

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <AppText color={c.mutedForeground}>New here? </AppText>
          <Link href="/sign-up" replace>
            <AppText color={c.primary} weight="semibold">Create an account</AppText>
          </Link>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
