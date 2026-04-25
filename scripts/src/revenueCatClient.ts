import { createClient } from "@replit/revenuecat-sdk/client";

let connectionSettings:
  | {
      settings: {
        access_token?: string;
        expires_at?: string;
        oauth?: { credentials?: { access_token?: string } };
      };
    }
  | undefined;

function extractAccessToken(
  s: NonNullable<typeof connectionSettings> | undefined,
): string | undefined {
  return (
    s?.settings?.access_token || s?.settings?.oauth?.credentials?.access_token
  );
}

async function getApiKey(): Promise<string> {
  if (
    connectionSettings &&
    connectionSettings.settings.expires_at &&
    new Date(connectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    const cachedToken = extractAccessToken(connectionSettings);
    if (cachedToken) return cachedToken;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  type ConnectionsResponse = {
    items?: NonNullable<typeof connectionSettings>[];
  };
  connectionSettings = await fetch(
    "https://" +
      hostname +
      "/api/v2/connection?include_secrets=true&connector_names=revenuecat",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    },
  )
    .then((res) => res.json() as Promise<ConnectionsResponse>)
    .then((data) => data.items?.[0]);

  const accessToken =
    connectionSettings?.settings?.access_token ||
    connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error("RevenueCat not connected");
  }
  return accessToken;
}

export async function getUncachableRevenueCatClient() {
  const apiKey = await getApiKey();
  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    headers: { Authorization: "Bearer " + apiKey },
  });
}
