import { useSignIn } from "@clerk/clerk-expo";
import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { AppText, Button, Field, Input } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!isLoaded) return;
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      // Step 1: initialize the sign-in attempt with both identifier and
      // password. Depending on the Clerk instance config this may either
      // immediately complete OR return `needs_first_factor`, which means
      // the attempt is initialized and we must explicitly verify the
      // password as the first factor.
      let attempt = await signIn.create({ identifier: email.trim(), password });

      if (attempt.status === "needs_first_factor") {
        const passwordFactor = attempt.supportedFirstFactors?.find(
          (f) => f.strategy === "password"
        );
        if (!passwordFactor) {
          // No password set on this account — most commonly an account
          // created via Google OAuth.  Tell the user what to do instead.
          const strategies = attempt.supportedFirstFactors
            ?.map((f) => String(f.strategy))
            .join(", ");
          Alert.alert(
            "Password sign-in unavailable",
            strategies
              ? `This account doesn't have a password. Sign-in methods available: ${strategies}.`
              : "This account doesn't have a password set up."
          );
          return;
        }
        attempt = await signIn.attemptFirstFactor({
          strategy: "password",
          password,
        });
      }

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/(tabs)");
      } else if (attempt.status === "needs_second_factor") {
        Alert.alert(
          "Two-factor required",
          "Two-factor authentication is required for this account, but isn't supported in the app yet. Please sign in on the web."
        );
      } else {
        Alert.alert(
          "Couldn't sign in",
          `Sign-in incomplete (status: ${attempt.status ?? "unknown"}). Please try again.`
        );
      }
    } catch (err: unknown) {
      const e = err as {
        errors?: { message?: string; longMessage?: string; code?: string }[];
        message?: string;
      };
      const clerkErr = e.errors?.[0];
      Alert.alert(
        "Couldn't sign in",
        clerkErr?.longMessage ??
          clerkErr?.message ??
          e.message ??
          "Please check your credentials."
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
