import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function IndexRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const c = useColors();

  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (isSignedIn) return <Redirect href="/(tabs)" />;
  return <Redirect href="/sign-in" />;
}
