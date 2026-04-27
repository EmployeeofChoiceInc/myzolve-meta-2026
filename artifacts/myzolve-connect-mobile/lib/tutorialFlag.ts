import AsyncStorage from "@react-native-async-storage/async-storage";

// Tracks whether a user has finished or skipped the guided in-app tutorial.
// Stored separately from the onboarding-acknowledged flag so the two can be
// reset independently — e.g. Settings → "Show me around again" wipes only
// this flag.
//
// Mirrors the in-memory + AsyncStorage pattern from onboardingFlag.ts so
// transient AsyncStorage failures (which have historically tripped up App
// Review) cannot keep replaying the tutorial.

const KEY_PREFIX = "myzolve.tutorial.seen.";

const seenInSession = new Set<string>();

function key(userId: string | null | undefined): string {
  return `${KEY_PREFIX}${userId ?? "anon"}`;
}

export async function hasSeenTutorial(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return true; // Don't auto-launch for anonymous sessions.
  if (seenInSession.has(userId)) return true;
  try {
    const v = await AsyncStorage.getItem(key(userId));
    if (v === "1") {
      seenInSession.add(userId);
      return true;
    }
    return false;
  } catch {
    // If storage is broken, fail closed — better to skip the tutorial than
    // to nag the user every cold launch.
    return true;
  }
}

export async function setTutorialSeen(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  seenInSession.add(userId);
  try {
    await AsyncStorage.setItem(key(userId), "1");
  } catch {
    // Best-effort; the in-memory mirror still suppresses replay this session.
  }
}

export async function resetTutorialSeen(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  seenInSession.delete(userId);
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // Best-effort.
  }
}
