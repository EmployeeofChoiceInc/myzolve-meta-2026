import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "myzolve.onboarding.acknowledged.";

function key(userId: string | null | undefined): string {
  return `${KEY_PREFIX}${userId ?? "anon"}`;
}

export async function hasAcknowledgedOnboarding(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const v = await AsyncStorage.getItem(key(userId));
    return v === "1";
  } catch {
    return false;
  }
}

export async function setOnboardingAcknowledged(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(key(userId), "1");
  } catch {
    // best-effort; never block UI on storage failures
  }
}
