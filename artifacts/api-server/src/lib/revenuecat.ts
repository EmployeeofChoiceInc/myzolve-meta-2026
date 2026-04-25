import { createClient } from "@replit/revenuecat-sdk/client";
import {
  listCustomerActiveEntitlements,
  listEntitlements,
} from "@replit/revenuecat-sdk";
import { logger } from "./logger";

export const PLUS_ENTITLEMENT_IDENTIFIER = "plus";

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
    // Fall through to refresh if the cached entry has no usable token.
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

// WARNING: Never cache this client. Access tokens expire — always create fresh.
export async function getUncachableRevenueCatClient() {
  const apiKey = await getApiKey();
  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    headers: { Authorization: "Bearer " + apiKey },
  });
}

// Brief in-memory cache so back-to-back gated requests don't hammer RevenueCat.
// Plus is a long-lived state; 60s of staleness is acceptable. Purchases that
// flip the bit propagate via the next request after TTL or a manual bust.
type CacheEntry = { value: boolean; expiresAt: number };
const PLUS_CACHE_TTL_MS = 60_000;
const plusCache = new Map<string, CacheEntry>();

// Cache of resolved entitlement IDs by lookup key. The active_entitlements
// endpoint returns RevenueCat-generated IDs (entle…), not lookup keys, so we
// resolve once at first use and reuse for the process lifetime.
const entitlementIdByLookupKey = new Map<string, string>();

export function bustIsPlusCache(userId: string) {
  plusCache.delete(userId);
}

async function resolvePlusEntitlementId(
  client: Awaited<ReturnType<typeof getUncachableRevenueCatClient>>,
  projectId: string,
): Promise<string | null> {
  const cached = entitlementIdByLookupKey.get(PLUS_ENTITLEMENT_IDENTIFIER);
  if (cached) return cached;

  const { data, error } = await listEntitlements({
    client,
    path: { project_id: projectId },
    query: { limit: 50 },
  });
  if (error) {
    logger.warn({ err: error }, "Failed to list project entitlements");
    return null;
  }
  for (const ent of data?.items ?? []) {
    if (ent.lookup_key) {
      entitlementIdByLookupKey.set(ent.lookup_key, ent.id);
    }
  }
  return entitlementIdByLookupKey.get(PLUS_ENTITLEMENT_IDENTIFIER) ?? null;
}

/**
 * Returns true iff the given Clerk userId currently has the `plus`
 * entitlement active in RevenueCat. Uses the userId as the RevenueCat
 * App User ID (set on the client via Purchases.logIn).
 *
 * On any error we return `false` and log — gated mutations should fail
 * closed rather than accidentally granting access.
 */
export async function isPlus(userId: string): Promise<boolean> {
  if (!userId) return false;

  const cached = plusCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) {
    logger.warn("REVENUECAT_PROJECT_ID is not set; isPlus is always false");
    return false;
  }

  try {
    const client = await getUncachableRevenueCatClient();
    const plusEntitlementId = await resolvePlusEntitlementId(client, projectId);
    if (!plusEntitlementId) {
      logger.warn(
        "Could not resolve `plus` entitlement id from RevenueCat project",
      );
      return false;
    }

    const { data, error } = await listCustomerActiveEntitlements({
      client,
      path: { project_id: projectId, customer_id: userId },
      query: { limit: 50 },
    });

    if (error) {
      const errType =
        typeof error === "object" && error && "type" in error
          ? (error as { type?: string }).type
          : undefined;
      // A customer that has never purchased anything may simply not exist yet.
      if (errType === "resource_missing" || errType === "not_found_error") {
        plusCache.set(userId, {
          value: false,
          expiresAt: Date.now() + PLUS_CACHE_TTL_MS,
        });
        return false;
      }
      logger.warn({ err: error, userId }, "Failed to list active entitlements");
      return false;
    }

    const hasPlus = (data?.items ?? []).some(
      (e) => e.entitlement_id === plusEntitlementId,
    );
    plusCache.set(userId, {
      value: hasPlus,
      expiresAt: Date.now() + PLUS_CACHE_TTL_MS,
    });
    return hasPlus;
  } catch (err) {
    logger.warn({ err, userId }, "isPlus check threw; failing closed");
    return false;
  }
}
