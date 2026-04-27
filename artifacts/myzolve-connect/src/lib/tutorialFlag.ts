// Tracks whether a Connect user has finished or skipped the guided in-app
// tutorial.  Stored in localStorage per Clerk user id so the two flags
// (onboarding-acknowledged vs. tutorial-seen) can be reset independently.
//
// All three helpers gracefully no-op for anonymous sessions, and treat any
// localStorage exception (private mode, quota errors, etc.) as "seen" so the
// tutorial can never lock the UI in a replay loop.

const KEY_PREFIX = "myzolve.tutorial.seen.";

function key(userId: string | null | undefined): string {
  return `${KEY_PREFIX}${userId ?? "anon"}`;
}

export function hasSeenTutorial(userId: string | null | undefined): boolean {
  if (!userId) return true;
  try {
    return window.localStorage.getItem(key(userId)) === "1";
  } catch {
    return true;
  }
}

export function setTutorialSeen(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(key(userId), "1");
  } catch {
    // Best-effort — if storage is unavailable we just won't remember between
    // page loads.  Within the same session the tutorial provider also keeps
    // an in-memory bit that prevents an immediate re-launch.
  }
}

export function resetTutorialSeen(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    window.localStorage.removeItem(key(userId));
  } catch {
    // Best-effort.
  }
}
