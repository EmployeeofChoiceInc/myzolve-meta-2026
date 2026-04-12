import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import {
  circlesTable,
  circleMembersTable,
} from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import {
  supportRequestsTable,
  servicePostsTable,
  activityFeedItemsTable,
  supportContributionsTable,
} from "@workspace/db";

const router = Router();

function circleToApi(circle: any, memberCount: number, myRole: string) {
  return {
    id: circle.id,
    name: circle.name,
    circleType: circle.circleType,
    description: circle.description,
    photoUrl: circle.photoUrl,
    currency: circle.currency,
    privacyMode: circle.privacyMode,
    ledgerMode: circle.ledgerMode,
    ownerId: circle.ownerId,
    memberCount,
    myRole,
    createdAt: circle.createdAt,
  };
}

router.get("/circles", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;

  const memberships = await db
    .select({
      circle: circlesTable,
      role: circleMembersTable.role,
    })
    .from(circleMembersTable)
    .innerJoin(circlesTable, eq(circleMembersTable.circleId, circlesTable.id))
    .where(
      and(
        eq(circleMembersTable.userId, userId),
        eq(circleMembersTable.status, "active"),
      ),
    );

  const circleIds = memberships.map((m) => m.circle.id);

  if (circleIds.length === 0) {
    res.json([]);
    return;
  }

  const memberCounts = await db
    .select({
      circleId: circleMembersTable.circleId,
      cnt: count(),
    })
    .from(circleMembersTable)
    .where(eq(circleMembersTable.status, "active"))
    .groupBy(circleMembersTable.circleId);

  const countMap = new Map(memberCounts.map((mc) => [mc.circleId, Number(mc.cnt)]));

  const result = memberships.map((m) => {
    const mc = countMap.get(m.circle.id) ?? 1;
    let role = m.role;
    if (m.circle.ownerId === userId) role = "owner";
    return circleToApi(m.circle, mc, role);
  });

  res.json(result);
});

router.post("/circles", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const {
    name,
    circleType = "family",
    description,
    currency = "USD",
    privacyMode = "private",
    ledgerMode = "private",
  } = req.body;

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [circle] = await db
    .insert(circlesTable)
    .values({
      name,
      circleType,
      description,
      currency,
      privacyMode,
      ledgerMode,
      ownerId: userId,
    })
    .returning();

  await db.insert(circleMembersTable).values({
    circleId: circle.id,
    userId,
    role: "owner",
    status: "active",
    joinedAt: new Date(),
  });

  res.status(201).json(circleToApi(circle, 1, "owner"));
});

router.get("/circles/:circleId", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const membership = await db
    .select()
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, circleId),
        eq(circleMembersTable.userId, userId),
        eq(circleMembersTable.status, "active"),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!membership) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const circle = await db
    .select()
    .from(circlesTable)
    .where(eq(circlesTable.id, circleId))
    .limit(1)
    .then((r) => r[0]);

  const [memberCount] = await db
    .select({ cnt: count() })
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, circleId),
        eq(circleMembersTable.status, "active"),
      ),
    );

  const role = circle.ownerId === userId ? "owner" : membership.role;
  res.json(circleToApi(circle, Number(memberCount.cnt), role));
});

router.patch("/circles/:circleId", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const circle = await db
    .select()
    .from(circlesTable)
    .where(eq(circlesTable.id, circleId))
    .limit(1)
    .then((r) => r[0]);

  if (!circle) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const membership = await db
    .select()
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, circleId),
        eq(circleMembersTable.userId, userId),
        eq(circleMembersTable.status, "active"),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { name, description, circleType, privacyMode, ledgerMode, currency } =
    req.body;

  const [updated] = await db
    .update(circlesTable)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(circleType !== undefined && { circleType }),
      ...(privacyMode !== undefined && { privacyMode }),
      ...(ledgerMode !== undefined && { ledgerMode }),
      ...(currency !== undefined && { currency }),
    })
    .where(eq(circlesTable.id, circleId))
    .returning();

  const [memberCount] = await db
    .select({ cnt: count() })
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, circleId),
        eq(circleMembersTable.status, "active"),
      ),
    );

  const role = updated.ownerId === userId ? "owner" : membership.role;
  res.json(circleToApi(updated, Number(memberCount.cnt), role));
});

router.delete("/circles/:circleId", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const circle = await db
    .select()
    .from(circlesTable)
    .where(eq(circlesTable.id, circleId))
    .limit(1)
    .then((r) => r[0]);

  if (!circle) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }
  if (circle.ownerId !== userId) {
    res.status(403).json({ error: "Only the owner can delete a circle" });
    return;
  }

  await db.delete(circlesTable).where(eq(circlesTable.id, circleId));
  res.status(204).end();
});

router.get("/circles/:circleId/stats", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const member = await db
    .select()
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, circleId),
        eq(circleMembersTable.userId, userId),
        eq(circleMembersTable.status, "active"),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!member) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const [totalMembersRow] = await db
    .select({ cnt: count() })
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, circleId),
        eq(circleMembersTable.status, "active"),
      ),
    );

  const [openRow] = await db
    .select({ cnt: count() })
    .from(supportRequestsTable)
    .where(
      and(
        eq(supportRequestsTable.circleId, circleId),
        eq(supportRequestsTable.status, "open"),
      ),
    );

  const [completedRow] = await db
    .select({ cnt: count() })
    .from(supportRequestsTable)
    .where(
      and(
        eq(supportRequestsTable.circleId, circleId),
        eq(supportRequestsTable.status, "completed"),
      ),
    );

  const [activeServicesRow] = await db
    .select({ cnt: count() })
    .from(servicePostsTable)
    .where(
      and(
        eq(servicePostsTable.circleId, circleId),
        eq(servicePostsTable.status, "open"),
      ),
    );

  const [recentActivityRow] = await db
    .select({ cnt: count() })
    .from(activityFeedItemsTable)
    .where(eq(activityFeedItemsTable.circleId, circleId));

  const contributionsSent = await db
    .select({
      total: sql<string>`COALESCE(SUM(${supportContributionsTable.amount}), 0)`,
    })
    .from(supportContributionsTable)
    .innerJoin(
      supportRequestsTable,
      eq(supportContributionsTable.requestId, supportRequestsTable.id),
    )
    .where(
      and(
        eq(supportRequestsTable.circleId, circleId),
        eq(supportContributionsTable.contributorUserId, userId),
        eq(supportContributionsTable.status, "confirmed"),
      ),
    )
    .then((r) => parseFloat(r[0]?.total ?? "0"));

  const contributionsReceived = await db
    .select({
      total: sql<string>`COALESCE(SUM(${supportContributionsTable.amount}), 0)`,
    })
    .from(supportContributionsTable)
    .innerJoin(
      supportRequestsTable,
      eq(supportContributionsTable.requestId, supportRequestsTable.id),
    )
    .where(
      and(
        eq(supportRequestsTable.circleId, circleId),
        eq(supportRequestsTable.createdByUserId, userId),
        eq(supportContributionsTable.status, "confirmed"),
      ),
    )
    .then((r) => parseFloat(r[0]?.total ?? "0"));

  res.json({
    circleId,
    totalMembers: Number(totalMembersRow.cnt),
    openRequests: Number(openRow.cnt),
    completedRequests: Number(completedRow.cnt),
    totalSupportGiven: contributionsSent,
    totalSupportReceived: contributionsReceived,
    activeServices: Number(activeServicesRow.cnt),
    recentActivityCount: Number(recentActivityRow.cnt),
  });
});

export default router;
