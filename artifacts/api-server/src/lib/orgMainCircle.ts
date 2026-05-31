import {
  db,
  circlesTable,
  circleMembersTable,
  orgsTable,
  orgMembersTable,
} from "@workspace/db";
import { and, eq, ne, sql } from "drizzle-orm";
import { logger } from "./logger";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Reunions/orgs are full group spaces built on the Circle feature set. Every
 * org owns exactly one auto-created "main" circle (isOrgMain = true) that all
 * members are enrolled in, plus any number of admin-created sub-circles
 * (orgId set, isOrgMain false). These helpers keep that invariant.
 */

/** Returns the id of an org's main circle, or null if it doesn't exist yet. */
export async function getOrgMainCircleId(orgId: number): Promise<number | null> {
  const row = await db
    .select({ id: circlesTable.id })
    .from(circlesTable)
    .where(
      and(eq(circlesTable.orgId, orgId), eq(circlesTable.isOrgMain, true)),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  return row?.id ?? null;
}

/**
 * Enroll a user as an active member of the org's main circle (idempotent).
 * No-op when the main circle doesn't exist (caller should ensure it first).
 */
export async function enrollInOrgMainCircle(
  orgId: number,
  userId: number,
  role: "owner" | "admin" | "member" = "member",
): Promise<void> {
  const mainCircleId = await getOrgMainCircleId(orgId);
  if (!mainCircleId) return;
  // Upsert so a previously-removed member (e.g. left and rejoined the reunion)
  // is reactivated rather than left stranded with a stale `removed` row.
  await db
    .insert(circleMembersTable)
    .values({
      circleId: mainCircleId,
      userId,
      role,
      status: "active",
      joinedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [circleMembersTable.circleId, circleMembersTable.userId],
      set: { status: "active", joinedAt: new Date() },
    });
}

/**
 * Ensure an org has a main circle, creating it (owned by `ownerId`) if missing.
 * The owner is enrolled as the circle owner. Returns the main circle id.
 */
export async function ensureOrgMainCircle(
  orgId: number,
  name: string,
  ownerId: number,
): Promise<number> {
  const existing = await getOrgMainCircleId(orgId);
  if (existing) return existing;

  // Conflict-safe insert: the partial unique index circles_org_main_uniq
  // guarantees at most one main circle per org even if two requests (or a
  // request + the startup backfill) race here. The loser gets an empty
  // `returning()` and falls back to re-reading the winner's row.
  const inserted = await db
    .insert(circlesTable)
    .values({
      name,
      circleType: "family",
      orgId,
      isOrgMain: true,
      ownerId,
    })
    .onConflictDoNothing({
      target: circlesTable.orgId,
      where: sql`${circlesTable.isOrgMain} = true`,
    })
    .returning({ id: circlesTable.id });

  const circleId = inserted[0]?.id ?? (await getOrgMainCircleId(orgId));
  if (!circleId) {
    throw new Error(`Failed to ensure main circle for org ${orgId}`);
  }

  await db
    .insert(circleMembersTable)
    .values({
      circleId,
      userId: ownerId,
      role: "owner",
      status: "active",
      joinedAt: new Date(),
    })
    .onConflictDoNothing();

  return circleId;
}

/**
 * Backfill: ensure every existing org has a main circle and that every active
 * org member is enrolled in it. Idempotent — safe to run on every startup.
 */
export async function backfillOrgMainCircles(): Promise<void> {
  try {
    const orgs = await db
      .select({ id: orgsTable.id, name: orgsTable.name, ownerId: orgsTable.ownerId })
      .from(orgsTable);

    let enrolled = 0;
    for (const org of orgs) {
      const mainCircleId = await ensureOrgMainCircle(org.id, org.name, org.ownerId);

      const members = await db
        .select({ userId: orgMembersTable.userId })
        .from(orgMembersTable)
        .where(
          and(
            eq(orgMembersTable.orgId, org.id),
            eq(orgMembersTable.status, "active"),
          ),
        );
      for (const m of members) {
        // Self-heal: insert missing rows and reactivate any that were left
        // `removed` (e.g. legacy data, or a member who left and rejoined).
        const result = await db
          .insert(circleMembersTable)
          .values({
            circleId: mainCircleId,
            userId: m.userId,
            role: "member",
            status: "active",
            joinedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [circleMembersTable.circleId, circleMembersTable.userId],
            set: { status: "active" },
            setWhere: ne(circleMembersTable.status, "active"),
          })
          .returning({ id: circleMembersTable.id });
        if (result.length > 0) enrolled += 1;
      }
    }
    logger.info(
      { orgCount: orgs.length, enrolled },
      "Org main-circle backfill complete",
    );
  } catch (err) {
    logger.error({ err }, "Org main-circle backfill failed");
  }
}

/**
 * Guard for org-scoped circles. If the circle belongs to a reunion/org
 * (circlesTable.orgId set), the target user MUST be an active member of that
 * org before they can be added to / accept an invite to / join the circle.
 * Returns null when allowed, or an error message when the user is not an
 * active org member. Personal circles (orgId null) are always allowed.
 */
export async function assertUserAllowedInCircle(
  circleId: number,
  userId: number,
  conn: DbOrTx = db,
): Promise<string | null> {
  const circle = await conn
    .select({ orgId: circlesTable.orgId })
    .from(circlesTable)
    .where(eq(circlesTable.id, circleId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!circle || circle.orgId == null) return null;

  const orgMember = await conn
    .select({ id: orgMembersTable.id })
    .from(orgMembersTable)
    .where(
      and(
        eq(orgMembersTable.orgId, circle.orgId),
        eq(orgMembersTable.userId, userId),
        eq(orgMembersTable.status, "active"),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!orgMember) {
    return "This space belongs to a reunion. Only active reunion members can join it.";
  }
  return null;
}

/**
 * Revoke a user's membership in ALL of an org's circles (main + sub-circles).
 * Called when a user is removed from / leaves an org so they lose access to the
 * reunion's group spaces. Idempotent.
 */
export async function revokeOrgCircleMemberships(
  orgId: number,
  userId: number,
  conn: DbOrTx = db,
): Promise<void> {
  const circles = await conn
    .select({ id: circlesTable.id })
    .from(circlesTable)
    .where(eq(circlesTable.orgId, orgId));
  if (circles.length === 0) return;

  for (const c of circles) {
    await conn
      .update(circleMembersTable)
      .set({ status: "removed", updatedAt: new Date() })
      .where(
        and(
          eq(circleMembersTable.circleId, c.id),
          eq(circleMembersTable.userId, userId),
        ),
      );
  }
}
