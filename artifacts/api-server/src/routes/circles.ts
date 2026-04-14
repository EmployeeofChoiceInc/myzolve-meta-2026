import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, circleIdParam } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  circlesTable,
  circleMembersTable,
  circleJoinRequestsTable,
  usersTable,
  type Circle,
} from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { createAuditLog } from "../lib/helpers";
import {
  supportRequestsTable,
  servicePostsTable,
  activityFeedItemsTable,
  supportContributionsTable,
} from "@workspace/db";

const router = Router();

const createCircleSchema = z.object({
  name: z.string().min(1).max(100),
  circleType: z.enum(["family", "chosen_family", "friends", "caregiving_circle", "neighborhood_circle", "other"]).optional().default("family"),
  description: z.string().max(1000).optional(),
  currency: z.string().length(3).optional().default("USD"),
  privacyMode: z.enum(["private", "hidden", "open", "community"]).optional().default("private"),
  ledgerMode: z.enum(["private", "summary", "full", "admin_only"]).optional().default("private"),
});

const updateCircleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  circleType: z.enum(["family", "chosen_family", "friends", "caregiving_circle", "neighborhood_circle", "other"]).optional(),
  description: z.string().max(1000).optional(),
  currency: z.string().length(3).optional(),
  privacyMode: z.enum(["private", "hidden", "open", "community"]).optional(),
  ledgerMode: z.enum(["private", "summary", "full", "admin_only"]).optional(),
});

function circleToApi(circle: Circle, memberCount: number, myRole: string | null) {
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

const createJoinRequestSchema = z.object({
  note: z.string().max(500).optional(),
});

router.get("/circles/discover", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;

  const openCircles = await db
    .select({
      circle: circlesTable,
      creatorName: usersTable.displayName,
      memberCount: count(circleMembersTable.id),
    })
    .from(circlesTable)
    .leftJoin(usersTable, eq(circlesTable.ownerId, usersTable.id))
    .leftJoin(
      circleMembersTable,
      and(
        eq(circleMembersTable.circleId, circlesTable.id),
        eq(circleMembersTable.status, "active"),
      ),
    )
    .where(sql`${circlesTable.privacyMode} IN ('open', 'community')`)
    .groupBy(circlesTable.id, usersTable.displayName);

  const circleIds = openCircles.map((c) => c.circle.id);

  const [myMemberships, myJoinRequests] = await Promise.all([
    circleIds.length > 0
      ? db
          .select({ circleId: circleMembersTable.circleId })
          .from(circleMembersTable)
          .where(
            and(
              eq(circleMembersTable.userId, userId),
              eq(circleMembersTable.status, "active"),
            ),
          )
      : Promise.resolve([]),
    circleIds.length > 0
      ? db
          .select({ circleId: circleJoinRequestsTable.circleId, status: circleJoinRequestsTable.status })
          .from(circleJoinRequestsTable)
          .where(eq(circleJoinRequestsTable.userId, userId))
      : Promise.resolve([]),
  ]);

  const memberSet = new Set(myMemberships.map((m) => m.circleId));
  const joinRequestMap = new Map(myJoinRequests.map((r) => [r.circleId, r.status]));

  res.json(
    openCircles.map(({ circle, creatorName, memberCount }) => ({
      id: circle.id,
      name: circle.name,
      circleType: circle.circleType,
      description: circle.description,
      currency: circle.currency,
      privacyMode: circle.privacyMode,
      ownerId: circle.ownerId,
      creatorName: creatorName ?? "Unknown",
      memberCount: Number(memberCount),
      isMember: memberSet.has(circle.id),
      joinRequestStatus: joinRequestMap.get(circle.id) ?? null,
      createdAt: circle.createdAt,
    })),
  );
});

router.post(
  "/circles/:circleId/join-request",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(createJoinRequestSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const { note } = req.body;

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

    if (!["open", "community"].includes(circle.privacyMode)) {
      res.status(403).json({ error: "This circle does not accept join requests" });
      return;
    }

    const existing = await db
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

    if (existing) {
      res.status(409).json({ error: "You are already a member of this circle" });
      return;
    }

    const existingRequest = await db
      .select()
      .from(circleJoinRequestsTable)
      .where(
        and(
          eq(circleJoinRequestsTable.circleId, circleId),
          eq(circleJoinRequestsTable.userId, userId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (existingRequest) {
      if (existingRequest.status === "pending") {
        res.status(409).json({ error: "You already have a pending join request for this circle" });
        return;
      }
      const [updated] = await db
        .update(circleJoinRequestsTable)
        .set({ status: "pending", note: note ?? null, reviewedByUserId: null, reviewedAt: null })
        .where(eq(circleJoinRequestsTable.id, existingRequest.id))
        .returning();
      res.status(201).json(updated);
      return;
    }

    const [joinRequest] = await db
      .insert(circleJoinRequestsTable)
      .values({ circleId, userId, note: note ?? null, status: "pending" })
      .returning();

    const owner = await db
      .select({ userId: circleMembersTable.userId })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.status, "active"),
        ),
      )
      .then((rows) => rows.filter((r) => r.userId !== null)) as { userId: number }[];

    const { createNotification } = await import("../lib/helpers");
    const requesterName = req.dbUser!.displayName;
    for (const m of owner) {
      await createNotification({
        userId: m.userId,
        circleId,
        notificationType: "join_request",
        title: "Someone wants to join your circle",
        body: `${requesterName} has requested to join ${circle.name}.`,
        targetEntityType: "circle_join_request",
        targetEntityId: joinRequest.id,
      });
    }

    res.status(201).json(joinRequest);
  },
);

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

router.post("/circles", requireAuth, validateBody(createCircleSchema), async (req, res) => {
  const userId = req.dbUser!.id;
  const {
    name,
    circleType = "family",
    description,
    currency = "USD",
    privacyMode = "private",
    ledgerMode = "private",
  } = req.body;

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

router.get("/circles/:circleId", requireAuth, validateParams(circleIdParam), async (req, res) => {
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

router.patch("/circles/:circleId", requireAuth, validateParams(circleIdParam), validateBody(updateCircleSchema), async (req, res) => {
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

  const changedFields: Record<string, unknown> = {};
  if (name !== undefined) changedFields.name = name;
  if (description !== undefined) changedFields.description = description;
  if (circleType !== undefined) changedFields.circleType = circleType;
  if (privacyMode !== undefined) changedFields.privacyMode = privacyMode;
  if (ledgerMode !== undefined) changedFields.ledgerMode = ledgerMode;
  if (currency !== undefined) changedFields.currency = currency;

  await createAuditLog({
    actorUserId: userId,
    circleId,
    action: privacyMode !== undefined ? "circle_privacy_changed" : "circle_settings_updated",
    targetEntityType: "circle",
    targetEntityId: circleId,
    metadata: changedFields,
  });

  res.json(circleToApi(updated, Number(memberCount.cnt), role));
});

router.delete("/circles/:circleId", requireAuth, validateParams(circleIdParam), async (req, res) => {
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

router.get("/circles/:circleId/stats", requireAuth, validateParams(circleIdParam), async (req, res) => {
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

  const isAdminOrOwner = ["owner", "admin"].includes(member.role);

  const isRequestVisible = (r: { visibilityScope: string | null; createdByUserId: number }) => {
    if (isAdminOrOwner) return true;
    if (r.visibilityScope === "private_draft" || r.visibilityScope === "admins_only") {
      return r.createdByUserId === userId;
    }
    return true;
  };

  const allOpenRequests = await db
    .select({ visibilityScope: supportRequestsTable.visibilityScope, createdByUserId: supportRequestsTable.createdByUserId })
    .from(supportRequestsTable)
    .where(and(eq(supportRequestsTable.circleId, circleId), eq(supportRequestsTable.status, "open")));

  const openRow = { cnt: allOpenRequests.filter(isRequestVisible).length };

  const allCompletedRequests = await db
    .select({ visibilityScope: supportRequestsTable.visibilityScope, createdByUserId: supportRequestsTable.createdByUserId })
    .from(supportRequestsTable)
    .where(and(eq(supportRequestsTable.circleId, circleId), eq(supportRequestsTable.status, "completed")));

  const completedRow = { cnt: allCompletedRequests.filter(isRequestVisible).length };

  const allActiveServices = await db
    .select({ visibilityScope: servicePostsTable.visibilityScope, createdByUserId: servicePostsTable.createdByUserId })
    .from(servicePostsTable)
    .where(and(eq(servicePostsTable.circleId, circleId), eq(servicePostsTable.status, "open")));

  const activeServicesRow = {
    cnt: isAdminOrOwner
      ? allActiveServices.length
      : allActiveServices.filter((s) => {
          if (s.visibilityScope === "admins_only") return s.createdByUserId === userId;
          return true;
        }).length,
  };

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
