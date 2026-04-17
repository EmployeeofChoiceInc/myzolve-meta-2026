declare global {
  interface Window {
    plausible?: (event: string, options?: { u?: string; props?: Record<string, unknown> }) => void;
  }
}

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  if (typeof window === "undefined") return;

  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
  if (!import.meta.env.PROD || !domain) return;

  const apiHost = (import.meta.env.VITE_PLAUSIBLE_API_HOST as string | undefined) ?? "https://plausible.io";

  const script = document.createElement("script");
  script.defer = true;
  script.setAttribute("data-domain", domain);
  script.src = `${apiHost.replace(/\/$/, "")}/js/script.js`;
  document.head.appendChild(script);

  initialized = true;
}

export function trackPageview(url?: string) {
  if (typeof window === "undefined" || typeof window.plausible !== "function") return;
  window.plausible("pageview", url ? { u: url } : undefined);
}
