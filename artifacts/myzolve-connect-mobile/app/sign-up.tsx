import { useSignUp } from "@clerk/expo";
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

export default function SignUpScreen() {
  const { signUp } = useSignUp();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"form" | "verify">("form");
  const [loading, setLoading] = useState(false);

  async function onCreate() {
    if (!email || !password) {
      Alert.alert(t("auth.missingInfo"), t("auth.missingInfoSignUp"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp.password({
        emailAddress: email.trim(),
        password,
      });
      if (error) {
        Alert.alert(
          t("auth.couldntSignUp"),
          describeError(error, t("auth.couldntSignUpBody")),
        );
        return;
      }
      await signUp.verifications.sendEmailCode();
      setStage("verify");
    } catch (err: unknown) {
      Alert.alert(
        t("auth.couldntSignUp"),
        describeError(err, t("auth.couldntSignUpBody")),
      );
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
        Alert.alert(t("auth.verificationIncomplete"), t("auth.verifyAgain"));
      }
    } catch (err: unknown) {
      Alert.alert(t("auth.couldntVerify"), describeError(err, t("auth.wrongCode")));
    } finally {
      setLoading(false);
    }
  }

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
          <Feather name="users" size={26} color={c.primary} />
        </View>
        <AppText variant="h1" accessibilityRole="header">
          {stage === "form" ? t("auth.joinCircle") : t("auth.confirmEmail")}
        </AppText>
        <AppText variant="body" color={c.mutedForeground} style={{ marginTop: 6, marginBottom: 28 }}>
          {stage === "form"
            ? t("auth.subtitleSignUp")
            : t("auth.weSentCodeTo", { email })}
        </AppText>

        {stage === "form" ? (
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
                placeholder={t("auth.passwordMinHint")}
                testID="input-password"
                accessibilityLabel={t("auth.password")}
              />
            </Field>
            <Button title={t("auth.createAccount")} onPress={onCreate} loading={loading} testID="button-signup" />
            {/* Required for sign-up; Clerk's bot protection is on by default */}
            <View nativeID="clerk-captcha" />

            <OAuthButtons />
          </>
        ) : (
          <>
            <Field label={t("auth.verificationCode")}>
              <Input
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="123456"
                testID="input-code"
                accessibilityLabel={t("auth.verificationCode")}
              />
            </Field>
            <Button title={t("auth.verifyAndContinue")} onPress={onVerify} loading={loading} testID="button-verify" />
          </>
        )}

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <AppText color={c.mutedForeground}>{t("auth.alreadyHaveAccount")}</AppText>
          <Link href="/sign-in" replace accessibilityRole="link">
            <AppText color={c.primary} weight="semibold">{t("auth.signInLink")}</AppText>
          </Link>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
