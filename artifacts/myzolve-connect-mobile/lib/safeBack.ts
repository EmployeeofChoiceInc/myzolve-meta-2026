import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * Navigate back, but fall through to the Home tab when there is no
 * history to pop.  This matters whenever a screen can be reached
 * with an empty stack — push notifications, deep links, invitation
 * URLs, fresh app launches that restored a deep route, etc.  A bare
 * `router.back()` silently no-ops in those cases, leaving the user
 * with no visible way out (the original "tap View Requests, then
 * force-quit the app to escape" trap).
 */
export function safeBack(router: Router) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)");
  }
}
