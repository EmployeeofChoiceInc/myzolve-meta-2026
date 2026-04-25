import { useAuth, useSignIn } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslation } from "react-i18next";

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

type SecondFactorStrategy = "totp" | "backup_code" | "email_code" | "phone_code";

type SupportedSecondFactor = {
  strategy?: string;
  safeIdentifier?: string | null;
};

function pickPrimaryStrategy(supported: SupportedSecondFactor[]): SecondFactorStrategy {
  // Prefer in this order: TOTP (no round-trip), then email_code, then phone_code,
  // and finally backup_code as a manual opt-in only.
  if (supported.some((f) => f?.strategy === "totp")) return "totp";
  if (supported.some((f) => f?.strategy === "email_code")) return "email_code";
  if (supported.some((f) => f?.strategy === "phone_code")) return "phone_code";
  return "totp";
}

export default function SignInScreen() {
  const { signIn } = useSignIn();
  const { getToken } = useAuth();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Second-factor (2FA) state: when Clerk returns "needs_second_factor",
  // we swap the form for a code input instead of bouncing the user to web.
  const [needs2fa, setNeeds2fa] = useState(false);
  const [supportsBackupCode, setSupportsBackupCode] = useState(false);
  const [strategy, setStrategy] = useState<SecondFactorStrategy>("totp");
  const [destination, setDestination] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);

  function reset2fa() {
    setNeeds2fa(false);
    setStrategy("totp");
    setCode("");
    setSupportsBackupCode(false);
    setDestination(null);
  }

  async function prepareIfNeeded(chosen: SecondFactorStrategy, supported: SupportedSecondFactor[]) {
    if (chosen !== "email_code" && chosen !== "phone_code") return;
    const mfa = (
      signIn as unknown as {
        mfa: {
          sendEmailCode: () => Promise<{ error?: unknown }>;
          sendPhoneCode: () => Promise<{ error?: unknown }>;
        };
      }
    ).mfa;
    const { error } =
      chosen === "email_code" ? await mfa.sendEmailCode() : await mfa.sendPhoneCode();
    if (error) {
      throw error;
    }
    const match = supported.find((f) => f?.strategy === chosen);
    setDestination(match?.safeIdentifier ?? null);
  }

  async function finalizeAndGo() {
    await signIn.finalize({
      navigate: async ({ session }) => {
        if (session?.currentTask) return;
        try {
          await Promise.race([
            getToken({ skipCache: true }),
            new Promise((resolve) => setTimeout(resolve, 4_000)),
          ]);
        } catch {
          // Best-effort: customFetch retry recovers on first 401.
        }
        router.replace("/(tabs)");
      },
    });
  }

  async function onSubmit() {
    if (!email || !password) {
      Alert.alert(t("auth.missingInfo"), t("auth.missingInfoBody"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await signIn.password({
        emailAddress: email.trim(),
        password,
      });

      if (error) {
        const code = (error as { errors?: { code?: string }[] })?.errors?.[0]?.code;
        const msg = describeError(error, t("auth.couldntSignInBody"));
        const looksLikeNoPassword =
          code === "strategy_for_user_invalid" ||
          /verification strategy is not valid/i.test(msg);
        Alert.alert(
          t("auth.couldntSignIn"),
          looksLikeNoPassword ? t("auth.noPasswordHint") : msg,
        );
        return;
      }

      if (signIn.status === "complete") {
        await finalizeAndGo();
      } else if (signIn.status === "needs_second_factor") {
        const supported =
          (signIn as unknown as { supportedSecondFactors?: SupportedSecondFactor[] })
            .supportedSecondFactors ?? [];
        const chosen = pickPrimaryStrategy(supported);
        const hasBackup = supported.some((f) => f?.strategy === "backup_code");
        setSupportsBackupCode(hasBackup);
        setStrategy(chosen);
        setCode("");
        setDestination(null);
        try {
          await prepareIfNeeded(chosen, supported);
        } catch (prepareErr) {
          Alert.alert(
            t("auth.couldntSendCode"),
            describeError(prepareErr, t("auth.couldntSendCodeBody")),
          );
          return;
        }
        setNeeds2fa(true);
      } else {
        Alert.alert(
          t("auth.couldntSignIn"),
          t("auth.couldntSignInBody"),
        );
      }
    } catch (err: unknown) {
      Alert.alert(
        t("auth.couldntSignIn"),
        describeError(err, t("auth.couldntSignInBody")),
      );
    } finally {
      setLoading(false);
    }
  }

  async function onResendCode() {
    if (strategy !== "email_code" && strategy !== "phone_code") return;
    setResending(true);
    try {
      const supported =
        (signIn as unknown as { supportedSecondFactors?: SupportedSecondFactor[] })
          .supportedSecondFactors ?? [];
      await prepareIfNeeded(strategy, supported);
      Alert.alert(
        t("auth.codeSent"),
        strategy === "email_code"
          ? t("auth.codeSentEmail")
          : t("auth.codeSentPhone"),
      );
    } catch (err) {
      Alert.alert(
        t("auth.couldntSendCode"),
        describeError(err, t("auth.couldntSendCodeBody")),
      );
    } finally {
      setResending(false);
    }
  }

  async function onSubmit2fa() {
    const trimmed = code.trim();
    if (!trimmed) {
      const promptByStrategy: Record<SecondFactorStrategy, { title: string; body: string }> = {
        totp: { title: t("auth.enterCode"), body: t("auth.promptTotp") },
        email_code: { title: t("auth.enterCode"), body: t("auth.promptEmail") },
        phone_code: { title: t("auth.enterCode"), body: t("auth.promptPhone") },
        backup_code: { title: t("auth.enterCodeBackup"), body: t("auth.promptBackup") },
      };
      const { title, body } = promptByStrategy[strategy];
      Alert.alert(title, body);
      return;
    }
    setLoading(true);
    try {
      const mfa = (
        signIn as unknown as {
          mfa: {
            verifyEmailCode: (args: { code: string }) => Promise<{ error?: unknown }>;
            verifyPhoneCode: (args: { code: string }) => Promise<{ error?: unknown }>;
            verifyTOTP: (args: { code: string }) => Promise<{ error?: unknown }>;
            verifyBackupCode: (args: { code: string }) => Promise<{ error?: unknown }>;
          };
        }
      ).mfa;
      const verify =
        strategy === "email_code"
          ? mfa.verifyEmailCode
          : strategy === "phone_code"
            ? mfa.verifyPhoneCode
            : strategy === "backup_code"
              ? mfa.verifyBackupCode
              : mfa.verifyTOTP;
      const { error } = await verify({ code: trimmed });

      if (error) {
        Alert.alert(
          t("auth.couldntVerify"),
          describeError(error, t("auth.wrongCode")),
        );
        return;
      }

      if (signIn.status === "complete") {
        await finalizeAndGo();
      } else {
        Alert.alert(t("auth.couldntSignIn"), t("auth.couldntSignInBody"));
      }
    } catch (err: unknown) {
      Alert.alert(
        t("auth.couldntVerify"),
        describeError(err, t("auth.wrongCode")),
      );
    } finally {
      setLoading(false);
    }
  }

  const heading = needs2fa
    ? strategy === "email_code"
      ? t("auth.checkYourEmail")
      : strategy === "phone_code"
        ? t("auth.checkYourPhone")
        : t("auth.twoFactorRequired")
    : t("auth.welcomeBack");

  const subheading = needs2fa
    ? strategy === "backup_code"
      ? t("auth.backupCodeBody")
      : strategy === "email_code"
        ? t("auth.emailCodeBody", { destination: destination ?? t("auth.yourEmail") })
        : strategy === "phone_code"
          ? t("auth.phoneCodeBody", { destination: destination ?? t("auth.yourPhone") })
          : t("auth.totpBody")
    : t("auth.subtitleSignIn");

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t("auth.closeButton")}
        hitSlop={10}
        style={{ padding: 16, alignSelf: "flex-end" }}
      >
        <Feather
          name="x"
          size={24}
          color={c.foreground}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </Pressable>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 8 }}
        bottomOffset={40}
        keyboardShouldPersistTaps="handled"
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
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
        <AppText variant="h1" accessibilityRole="header">{heading}</AppText>
        <AppText variant="body" color={c.mutedForeground} style={{ marginTop: 6, marginBottom: 28 }}>
          {subheading}
        </AppText>

        {needs2fa ? (
          <>
            <Field
              label={
                strategy === "backup_code"
                  ? t("auth.labelBackupCode")
                  : strategy === "email_code"
                    ? t("auth.labelEmailCode")
                    : strategy === "phone_code"
                      ? t("auth.labelSmsCode")
                      : t("auth.labelAuthCode")
              }
            >
              <Input
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={strategy === "backup_code" ? "default" : "number-pad"}
                placeholder={strategy === "backup_code" ? t("auth.placeholderBackup") : "123456"}
                testID="input-2fa-code"
              />
            </Field>

            <Button
              title={t("auth.verify")}
              onPress={onSubmit2fa}
              loading={loading}
              testID="button-2fa-verify"
            />

            {strategy === "email_code" || strategy === "phone_code" ? (
              <Pressable
                onPress={onResendCode}
                disabled={resending}
                accessibilityRole="button"
                accessibilityLabel={t("auth.resendCode")}
                accessibilityState={{ disabled: resending }}
                hitSlop={8}
                style={{ marginTop: 16, alignItems: "center", opacity: resending ? 0.5 : 1 }}
                testID="button-2fa-resend"
              >
                <AppText color={c.primary} weight="semibold">
                  {resending ? t("auth.sending") : t("auth.resendCode")}
                </AppText>
              </Pressable>
            ) : supportsBackupCode ? (
              <Pressable
                onPress={() => {
                  setStrategy(strategy === "totp" ? "backup_code" : "totp");
                  setCode("");
                }}
                accessibilityRole="button"
                hitSlop={8}
                style={{ marginTop: 16, alignItems: "center" }}
                testID="button-2fa-toggle"
              >
                <AppText color={c.primary} weight="semibold">
                  {strategy === "totp" ? t("auth.useBackupInstead") : t("auth.useAuthInstead")}
                </AppText>
              </Pressable>
            ) : null}

            <Pressable
              onPress={reset2fa}
              accessibilityRole="button"
              accessibilityLabel={t("auth.useDifferentAccount")}
              hitSlop={8}
              style={{ marginTop: 12, alignItems: "center" }}
              testID="button-2fa-cancel"
            >
              <AppText color={c.mutedForeground}>{t("auth.useDifferentAccount")}</AppText>
            </Pressable>
          </>
        ) : (
          <>
            <Field label={t("auth.email")}>
              <Input
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                testID="input-email"
                accessibilityLabel={t("auth.email")}
              />
            </Field>
            <Field label={t("auth.password")}>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                testID="input-password"
                accessibilityLabel={t("auth.password")}
              />
            </Field>

            <Button title={t("auth.signIn")} onPress={onSubmit} loading={loading} testID="button-signin" />

            <OAuthButtons />

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
              <AppText color={c.mutedForeground}>{t("auth.newHere")}</AppText>
              <Link href="/sign-up" replace accessibilityRole="link">
                <AppText color={c.primary} weight="semibold">{t("auth.createAccountLink")}</AppText>
              </Link>
            </View>
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}
