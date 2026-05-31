import { db, circleMembersTable, circlesTable } from "@workspace/db";
import { and, count, eq, isNull } from "drizzle-orm";
import { isPlus } from "./revenuecat";

/**
 * Free tier soft cap on the number of active circle memberships per user.
 * Beyond this, callers are nudged to upgrade to Plus. Memberships above the
 * cap that already exist (e.g. someone who downgrades from Plus) are NEVER
 * removed retroactively — only NEW joins/creates are blocked.
 */
export const FREE_CIRCLE_LIMIT = 2;

export async function countActiveMemberships(userId: number): Promise<number> {
  // Org/reunion-scoped circles never count against the personal cap — org
  // members already receive Plus (unlimited circles), and the auto-enrolled
  // main circle must not push anyone over the free limit.
  const [row] = await db
    .select({ cnt: count() })
    .from(circleMembersTable)
    .innerJoin(circlesTable, eq(circleMembersTable.circleId, circlesTable.id))
    .where(
      and(
        eq(circleMembersTable.userId, userId),
        eq(circleMembersTable.status, "active"),
        isNull(circlesTable.orgId),
      ),
    );
  return Number(row?.cnt ?? 0);
}

/**
 * Returns `null` when the user can join another circle, or a 402-style
 * payload when the cap has been hit and the user is not Plus. Callers
 * should respond with `res.status(402).json(payload)` so the mobile
 * client can open the paywall.
 *
 * `clerkId` is the Clerk user id used as the RevenueCat App User ID.
 */
export async function assertCanJoinAnotherCircle(params: {
  userId: number;
  clerkId: string;
}): Promise<null | { error: "plus_required"; message: string; reason: "circle_limit" }> {
  const active = await countActiveMemberships(params.userId);
  if (active < FREE_CIRCLE_LIMIT) return null;
  const plus = await isPlus(params.clerkId);
  if (plus) return null;
  return {
    error: "plus_required",
    reason: "circle_limit",
    message: `You're in ${active} circles already — MyZolve Connect Plus unlocks unlimited circles.`,
  };
}
