import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "myzolve.onboarding.acknowledged.";

// In-memory mirror of the persisted flag.  Acts as a short-circuit
// AND a defense against transient AsyncStorage failures: even if the
// underlying storage write/read fails (rare on iOS, but possible —
// and exactly the kind of thing that has historically tripped up App
// Review), once the user has acknowledged onboarding in this session
// they will never be redirected back to it.
const acknowledgedInSession = new Set<string>();

function key(userId: string | null | undefined): string {
  return `${KEY_PREFIX}${userId ?? "anon"}`;
}

export async function hasAcknowledgedOnboarding(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  if (acknowledgedInSession.has(userId)) return true;
  try {
    const v = await AsyncStorage.getItem(key(userId));
    if (v === "1") {
      acknowledgedInSession.add(userId);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function setOnboardingAcknowledged(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  // Mark in-memory FIRST and synchronously so that even if AsyncStorage
  // is slow or fails, the very next render of Home sees the flag.
  acknowledgedInSession.add(userId);
  try {
    await AsyncStorage.setItem(key(userId), "1");
  } catch {
    // Best-effort; the in-memory mirror keeps the user unstuck for
    // the rest of the session even if persistence failed.
  }
}
