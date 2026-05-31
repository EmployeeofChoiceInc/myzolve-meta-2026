import { and, eq, inArray } from "drizzle-orm";
import { db, orgsTable, orgMembersTable, usersTable, type Org } from "@workspace/db";
import { getActiveOrgCompIds } from "./comps";

/**
 * After an org payment fails we keep members' Plus alive for this long before
 * downgrading them. Mirrors the family-plan grace window so a single late
 * renewal doesn't visibly downgrade a whole organization.
 */
export const ORG_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * True when an org's seat pool is currently "live" — i.e. active members
 * should be treated as Plus. Active always counts. `past_due` counts only
 * while inside the grace window (graceEndsAt in the future).
 */
export function isOrgSeatActive(
  org: Pick<Org, "status" | "graceEndsAt">,
  now: Date = new Date(),
): boolean {
  if (org.status === "active") return true;
  if (org.status === "past_due") {
    return !!org.graceEndsAt && org.graceEndsAt.getTime() > now.getTime();
  }
  return false;
}

export type OrgEntitlement = {
  orgId: number;
  orgName: string;
  role: string;
  logoObjectPath: string | null;
  accentColor: string | null;
};

/**
 * Returns the active org seat entitlement for a Clerk user, or null. A user
 * is entitled if they are an active member of an org whose seat pool is live.
 * Returns the first matching org (a user is realistically in one org).
 */
export async function getOrgEntitlement(
  clerkId: string,
): Promise<OrgEntitlement | null> {
  if (!clerkId) return null;

  const caller = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!caller) return null;

  const rows = await db
    .select({
      orgId: orgsTable.id,
      orgName: orgsTable.name,
      status: orgsTable.status,
      graceEndsAt: orgsTable.graceEndsAt,
      logoObjectPath: orgsTable.logoObjectPath,
      accentColor: orgsTable.accentColor,
      role: orgMembersTable.role,
    })
    .from(orgMembersTable)
    .innerJoin(orgsTable, eq(orgsTable.id, orgMembersTable.orgId))
    .where(
      and(
        eq(orgMembersTable.userId, caller.id),
        eq(orgMembersTable.status, "active"),
      ),
    );

  const now = new Date();
  // A comped org's seat pool is treated as live even when its Stripe status
  // isn't active/past_due — that's the whole point of a complimentary org grant.
  const compedOrgIds = await getActiveOrgCompIds(
    rows.map((r) => r.orgId),
    now,
  );
  for (const row of rows) {
    if (
      compedOrgIds.has(row.orgId) ||
      isOrgSeatActive({ status: row.status, graceEndsAt: row.graceEndsAt }, now)
    ) {
      return {
        orgId: row.orgId,
        orgName: row.orgName,
        role: row.role,
        logoObjectPath: row.logoObjectPath,
        accentColor: row.accentColor,
      };
    }
  }
  return null;
}

/**
 * Lightweight branding lookup for a set of org ids. Returns a map keyed by
 * org id with name + branding, used to decorate org-scoped Circle responses.
 */
export async function getOrgBrandingMap(
  orgIds: number[],
): Promise<
  Map<
    number,
    { name: string; logoObjectPath: string | null; accentColor: string | null }
  >
> {
  const unique = Array.from(new Set(orgIds.filter((id): id is number => id != null)));
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({
      id: orgsTable.id,
      name: orgsTable.name,
      logoObjectPath: orgsTable.logoObjectPath,
      accentColor: orgsTable.accentColor,
    })
    .from(orgsTable)
    .where(inArray(orgsTable.id, unique));
  return new Map(
    rows.map((r) => [
      r.id,
      {
        name: r.name,
        logoObjectPath: r.logoObjectPath,
        accentColor: r.accentColor,
      },
    ]),
  );
}
