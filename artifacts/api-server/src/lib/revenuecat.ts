import { createClient } from "@replit/revenuecat-sdk/client";
import {
  listCustomerActiveEntitlements,
  listEntitlements,
} from "@replit/revenuecat-sdk";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  circleMembersTable,
  circlesTable,
  usersTable,
} from "@workspace/db";
import { logger } from "./logger";
import { getOrgEntitlement } from "./orgEntitlement";

/**
 * Hard cap on the number of family members that receive derived Plus from
 * one family-plan subscription. Mirrors the value advertised in the paywall.
 */
export const FAMILY_PLAN_MEMBER_CAP = 6;

/**
 * After a family-plan subscriber's entitlement lapses, derived recipients
 * keep Plus for this long so a single late renewal doesn't visibly downgrade
 * everyone in the family circle.
 */
export const FAMILY_PLAN_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

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
 * entitlement active in RevenueCat directly (i.e. their own purchase).
 * Used as the building block for `isPlus`, which also considers derived
 * Plus from a family-plan subscriber's family circle.
 *
 * On any error we return `false` and log — gated mutations should fail
 * closed rather than accidentally granting access.
 *
 * Side effect: when the call succeeds AND the user is currently active,
 * `users.subscription_last_active_at` is bumped to "now" so derived
 * recipients can be granted a 7-day grace window after a lapse.
 */
export async function isPlusDirect(userId: string): Promise<boolean> {
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

    if (hasPlus) {
      // Best-effort snapshot for the family-plan grace window. We deliberately
      // don't await — a momentary DB hiccup must not break entitlement reads.
      void db
        .update(usersTable)
        .set({ subscriptionLastActiveAt: new Date() })
        .where(eq(usersTable.clerkId, userId))
        .catch((err) => {
          logger.warn(
            { err, userId },
            "Failed to update subscription_last_active_at",
          );
        });
    }

    return hasPlus;
  } catch (err) {
    logger.warn({ err, userId }, "isPlusDirect check threw; failing closed");
    return false;
  }
}

type DerivedPlusInfo = {
  via: "family";
  circleId: number;
  ownerUserId: number;
  ownerName: string;
  graceUntil: Date | null;
};

/**
 * Looks up whether `userId` (Clerk id) currently has Plus *derived* from
 * being one of the first FAMILY_PLAN_MEMBER_CAP active members of any
 * family-plan subscriber's `family_circle_id`. Returns the gifter info on
 * a hit, or null otherwise.
 *
 * Important guarantees:
 *  - Members 7+ in the chosen family circle do NOT receive Plus, even if
 *    members above them later leave (we walk in joinedAt asc / createdAt asc).
 *  - The subscriber themselves is not counted against the cap if they are
 *    also a member of the family circle — they already have direct Plus.
 *  - Owner Plus is checked via `isPlusDirect` (live RC) and falls back to
 *    `subscription_last_active_at` within FAMILY_PLAN_GRACE_MS for the
 *    7-day grace window.
 */
async function getDerivedPlusInfo(
  userId: string,
): Promise<DerivedPlusInfo | null> {
  if (!userId) return null;

  // Resolve the caller's internal user id once.
  const callerRows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId))
    .limit(1);
  const caller = callerRows[0];
  if (!caller) return null;

  // Find every family circle the caller is currently an active member of
  // whose owner has elected the family plan and designated this circle.
  // We then narrow to circles where the caller is among the first
  // FAMILY_PLAN_MEMBER_CAP active members.
  const candidateCircles = await db
    .select({
      circleId: circlesTable.id,
      ownerUserId: circlesTable.ownerId,
      ownerClerkId: usersTable.clerkId,
      ownerName: usersTable.displayName,
      ownerLastActiveAt: usersTable.subscriptionLastActiveAt,
    })
    .from(circlesTable)
    .innerJoin(usersTable, eq(usersTable.id, circlesTable.ownerId))
    .innerJoin(
      circleMembersTable,
      and(
        eq(circleMembersTable.circleId, circlesTable.id),
        eq(circleMembersTable.userId, caller.id),
        eq(circleMembersTable.status, "active"),
      ),
    )
    .where(
      and(
        eq(usersTable.planKind, "family"),
        eq(usersTable.familyCircleId, circlesTable.id),
      ),
    );

  for (const candidate of candidateCircles) {
    // Skip circles where the caller IS the owner — they should already get
    // direct Plus and the caller path covers it.
    if (candidate.ownerUserId === caller.id) continue;

    // Pull active members in stable order, then drop the owner before
    // taking the first FAMILY_PLAN_MEMBER_CAP. The owner already has direct
    // Plus and must not consume one of the gifted slots — otherwise we'd
    // gift to only `cap - 1` recipients whenever the owner is also a member
    // of their own circle (the common case for "family" circles).
    const earliestMembers = await db
      .select({ userId: circleMembersTable.userId })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, candidate.circleId),
          eq(circleMembersTable.status, "active"),
        ),
      )
      .orderBy(
        asc(circleMembersTable.joinedAt),
        asc(circleMembersTable.createdAt),
        asc(circleMembersTable.id),
      )
      .limit(FAMILY_PLAN_MEMBER_CAP + 1);

    const eligibleIds = earliestMembers
      .map((m) => m.userId)
      .filter((id): id is number => id != null && id !== candidate.ownerUserId)
      .slice(0, FAMILY_PLAN_MEMBER_CAP);
    if (!eligibleIds.includes(caller.id)) continue;

    // Owner must be Plus (direct, or within grace).
    const ownerActive = await isPlusDirect(candidate.ownerClerkId);
    let graceUntil: Date | null = null;
    if (!ownerActive) {
      const last = candidate.ownerLastActiveAt;
      if (!last) continue;
      const cutoff = new Date(last.getTime() + FAMILY_PLAN_GRACE_MS);
      if (cutoff.getTime() <= Date.now()) continue;
      graceUntil = cutoff;
    }

    return {
      via: "family",
      circleId: candidate.circleId,
      ownerUserId: candidate.ownerUserId,
      ownerName: candidate.ownerName,
      graceUntil,
    };
  }

  return null;
}

/**
 * Returns true iff the given Clerk userId currently has Plus access — either
 * a direct purchased entitlement OR derived access via a family-plan
 * subscriber's family circle.
 */
export async function isPlus(userId: string): Promise<boolean> {
  if (!userId) return false;
  if (await isPlusDirect(userId)) return true;
  const derived = await getDerivedPlusInfo(userId);
  if (derived !== null) return true;
  // Enterprise org members are treated as Plus while their seat is active.
  const org = await getOrgEntitlement(userId);
  return org !== null;
}

export type PlusStatus = {
  isPlus: boolean;
  source: "direct" | "family" | "org" | "none";
  planKind: "solo" | "family";
  familyCircleId: number | null;
  familyCircleMemberCount: number | null;
  familyCircleMemberCap: number;
  gifterUserId: number | null;
  gifterName: string | null;
  gifterCircleId: number | null;
  graceUntil: string | null;
  // Enterprise org membership, when the user's Plus comes from an org seat
  // (or simply to surface "Member of [Org]" regardless of Plus source).
  orgId: number | null;
  orgName: string | null;
};

/**
 * Builds the rich Plus status payload returned by /me/plus-status. Always
 * resolves — failures yield a `none` status.
 */
export async function getPlusStatus(user: {
  id: number;
  clerkId: string;
  planKind: string;
  familyCircleId: number | null;
}): Promise<PlusStatus> {
  const direct = await isPlusDirect(user.clerkId);
  const org = await getOrgEntitlement(user.clerkId);

  let familyCircleMemberCount: number | null = null;
  if (user.planKind === "family" && user.familyCircleId != null) {
    const members = await db
      .select({ id: circleMembersTable.id })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, user.familyCircleId),
          eq(circleMembersTable.status, "active"),
        ),
      );
    familyCircleMemberCount = members.length;
  }

  if (direct) {
    return {
      isPlus: true,
      source: "direct",
      planKind: user.planKind === "family" ? "family" : "solo",
      familyCircleId: user.familyCircleId ?? null,
      familyCircleMemberCount,
      familyCircleMemberCap: FAMILY_PLAN_MEMBER_CAP,
      gifterUserId: null,
      gifterName: null,
      gifterCircleId: null,
      graceUntil: null,
      orgId: org?.orgId ?? null,
      orgName: org?.orgName ?? null,
    };
  }

  const derived = await getDerivedPlusInfo(user.clerkId);
  if (derived) {
    return {
      isPlus: true,
      source: "family",
      planKind: user.planKind === "family" ? "family" : "solo",
      familyCircleId: user.familyCircleId ?? null,
      familyCircleMemberCount,
      familyCircleMemberCap: FAMILY_PLAN_MEMBER_CAP,
      gifterUserId: derived.ownerUserId,
      gifterName: derived.ownerName,
      gifterCircleId: derived.circleId,
      graceUntil: derived.graceUntil ? derived.graceUntil.toISOString() : null,
      orgId: org?.orgId ?? null,
      orgName: org?.orgName ?? null,
    };
  }

  if (org) {
    return {
      isPlus: true,
      source: "org",
      planKind: user.planKind === "family" ? "family" : "solo",
      familyCircleId: user.familyCircleId ?? null,
      familyCircleMemberCount,
      familyCircleMemberCap: FAMILY_PLAN_MEMBER_CAP,
      gifterUserId: null,
      gifterName: null,
      gifterCircleId: null,
      graceUntil: null,
      orgId: org.orgId,
      orgName: org.orgName,
    };
  }

  return {
    isPlus: false,
    source: "none",
    planKind: user.planKind === "family" ? "family" : "solo",
    familyCircleId: user.familyCircleId ?? null,
    familyCircleMemberCount,
    familyCircleMemberCap: FAMILY_PLAN_MEMBER_CAP,
    gifterUserId: null,
    gifterName: null,
    gifterCircleId: null,
    graceUntil: null,
    orgId: null,
    orgName: null,
  };
}
