import { and, desc, eq, inArray, isNull, gt, or } from "drizzle-orm";
import { db, compsTable, usersTable } from "@workspace/db";

/**
 * A comp is "active" when it has not been revoked and is either indefinite
 * (`expiresAt` is null) or has not yet expired. Shared SQL predicate so the
 * entitlement checks stay consistent.
 */
function activeCompPredicate(now: Date) {
  return and(
    isNull(compsTable.revokedAt),
    or(isNull(compsTable.expiresAt), gt(compsTable.expiresAt, now)),
  );
}

/**
 * Returns the active user-level comp for a Clerk user, or null. When present,
 * the user should be treated as Plus directly (source "comp").
 */
export async function getActiveUserComp(
  clerkId: string,
  now: Date = new Date(),
): Promise<{ expiresAt: Date | null } | null> {
  if (!clerkId) return null;

  const caller = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!caller) return null;

  const row = await db
    .select({ expiresAt: compsTable.expiresAt })
    .from(compsTable)
    .where(
      and(
        eq(compsTable.targetType, "user"),
        eq(compsTable.userId, caller.id),
        activeCompPredicate(now),
      ),
    )
    .orderBy(desc(compsTable.createdAt))
    .limit(1)
    .then((r) => r[0] ?? null);

  return row ? { expiresAt: row.expiresAt ?? null } : null;
}

/**
 * Convenience boolean wrapper around getActiveUserComp.
 */
export async function hasActiveUserComp(
  clerkId: string,
  now: Date = new Date(),
): Promise<boolean> {
  return (await getActiveUserComp(clerkId, now)) !== null;
}

/**
 * Given a set of org ids, returns the subset that currently have an active
 * org-level comp. Used to treat a comped org's seat pool as live without a
 * Stripe payment.
 */
export async function getActiveOrgCompIds(
  orgIds: number[],
  now: Date = new Date(),
): Promise<Set<number>> {
  const unique = Array.from(
    new Set(orgIds.filter((id): id is number => id != null)),
  );
  if (unique.length === 0) return new Set();

  const rows = await db
    .select({ orgId: compsTable.orgId })
    .from(compsTable)
    .where(
      and(
        eq(compsTable.targetType, "org"),
        inArray(compsTable.orgId, unique),
        activeCompPredicate(now),
      ),
    );

  return new Set(
    rows
      .map((r) => r.orgId)
      .filter((id): id is number => id != null),
  );
}

/**
 * True if the given single org currently has an active org-level comp.
 */
export async function isOrgComped(
  orgId: number,
  now: Date = new Date(),
): Promise<boolean> {
  const set = await getActiveOrgCompIds([orgId], now);
  return set.has(orgId);
}
