import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "myzolve.year-recap.shown.";

const shownInSession = new Set<string>();

function key(userId: string | null | undefined, year: number): string {
  return `${KEY_PREFIX}${userId ?? "anon"}.${year}`;
}

export async function hasSeenYearRecap(
  userId: string | null | undefined,
  year: number,
): Promise<boolean> {
  if (!userId) return true; // Don't auto-present to anonymous sessions.
  const k = key(userId, year);
  if (shownInSession.has(k)) return true;
  try {
    const v = await AsyncStorage.getItem(k);
    if (v === "1") {
      shownInSession.add(k);
      return true;
    }
    return false;
  } catch {
    return true; // If storage is broken, fail closed — don't keep popping the modal.
  }
}

export async function markYearRecapSeen(
  userId: string | null | undefined,
  year: number,
): Promise<void> {
  if (!userId) return;
  const k = key(userId, year);
  shownInSession.add(k);
  try {
    await AsyncStorage.setItem(k, "1");
  } catch {
    // Best-effort.
  }
}
