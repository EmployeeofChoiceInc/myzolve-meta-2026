import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useColors } from "@/hooks/useColors";

export default function NotFoundScreen() {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t("navigation.notFound") }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.6}
          style={[styles.title, { color: colors.foreground }]}
        >
          {t("notFound.title")}
        </Text>

        <Link href="/" style={styles.link} accessibilityRole="link">
          <Text
            maxFontSizeMultiplier={1.6}
            style={[styles.linkText, { color: colors.primary }]}
          >
            {t("notFound.goHome")}
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
