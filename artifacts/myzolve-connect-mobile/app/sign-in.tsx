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

type SecondFactorStrategy = "totp" | "backup_code";

export default function SignInScreen() {
  const { signIn } = useSignIn();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Second-factor (2FA) state: when Clerk returns "needs_second_factor",
  // we swap the form for a code input instead of bouncing the user to web.
  const [needs2fa, setNeeds2fa] = useState(false);
  const [supportsBackupCode, setSupportsBackupCode] = useState(false);
  const [strategy, setStrategy] = useState<SecondFactorStrategy>("totp");
  const [code, setCode] = useState("");

  function reset2fa() {
    setNeeds2fa(false);
    setStrategy("totp");
    setCode("");
    setSupportsBackupCode(false);
  }

  async function finalizeAndGo() {
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
  }

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
        await finalizeAndGo();
      } else if (signIn.status === "needs_second_factor") {
        // Inspect supported strategies so we know whether to offer the
        // "Use backup code" toggle.
        const supported =
          (signIn as unknown as { supportedSecondFactors?: { strategy?: string }[] })
            .supportedSecondFactors ?? [];
        const hasBackup = supported.some((f) => f?.strategy === "backup_code");
        setSupportsBackupCode(hasBackup);
        setStrategy("totp");
        setCode("");
        setNeeds2fa(true);
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

  async function onSubmit2fa() {
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert(
        strategy === "backup_code" ? "Enter backup code" : "Enter code",
        strategy === "backup_code"
          ? "Please enter one of your backup codes."
          : "Please enter the 6-digit code from your authenticator app."
      );
      return;
    }
    setLoading(true);
    try {
      // Clerk Expo SDK exposes attemptSecondFactor on the signIn resource.
      // Strategy is either "totp" or "backup_code".
      const attempt = (
        signIn as unknown as {
          attemptSecondFactor: (args: {
            strategy: SecondFactorStrategy;
            code: string;
          }) => Promise<{ error?: unknown }>;
        }
      ).attemptSecondFactor;
      const { error } = await attempt({ strategy, code: trimmed });

      if (error) {
        Alert.alert(
          "Couldn't verify",
          describeError(error, "That code didn't work. Please try again.")
        );
        return;
      }

      if (signIn.status === "complete") {
        await finalizeAndGo();
      } else {
        Alert.alert(
          "Couldn't sign in",
          `Sign-in incomplete (status: ${signIn.status ?? "unknown"}). Please try again.`
        );
      }
    } catch (err: unknown) {
      Alert.alert(
        "Couldn't verify",
        describeError(err, "That code didn't work. Please try again.")
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
        <AppText variant="h1">{needs2fa ? "Two-factor required" : "Welcome back"}</AppText>
        <AppText variant="body" color={c.mutedForeground} style={{ marginTop: 6, marginBottom: 28 }}>
          {needs2fa
            ? strategy === "backup_code"
              ? "Enter one of the backup codes you saved when you turned on 2FA."
              : "Open your authenticator app and enter the 6-digit code."
            : "Sign in to your trusted circles."}
        </AppText>

        {needs2fa ? (
          <>
            <Field
              label={strategy === "backup_code" ? "Backup code" : "Authenticator code"}
            >
              <Input
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={strategy === "backup_code" ? "default" : "number-pad"}
                placeholder={strategy === "backup_code" ? "e.g. abcd-1234" : "123456"}
                testID="input-2fa-code"
              />
            </Field>

            <Button
              title="Verify"
              onPress={onSubmit2fa}
              loading={loading}
              testID="button-2fa-verify"
            />

            {supportsBackupCode ? (
              <Pressable
                onPress={() => {
                  setStrategy(strategy === "totp" ? "backup_code" : "totp");
                  setCode("");
                }}
                style={{ marginTop: 16, alignItems: "center" }}
                testID="button-2fa-toggle"
              >
                <AppText color={c.primary} weight="semibold">
                  {strategy === "totp" ? "Use a backup code instead" : "Use authenticator code instead"}
                </AppText>
              </Pressable>
            ) : null}

            <Pressable
              onPress={reset2fa}
              style={{ marginTop: 12, alignItems: "center" }}
              testID="button-2fa-cancel"
            >
              <AppText color={c.mutedForeground}>Use a different account</AppText>
            </Pressable>
          </>
        ) : (
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
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}
