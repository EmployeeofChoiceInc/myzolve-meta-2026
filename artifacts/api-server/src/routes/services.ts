import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, serviceIdParam, circleIdParam } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  servicePostsTable,
  serviceMatchesTable,
  circleMembersTable,
  usersTable,
  activityFeedItemsTable,
  type ServicePost,
} from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";

const router = Router();

const createServiceSchema = z.object({
  serviceType: z.enum(["offer", "request", "barter_offer", "barter_request"]).optional().default("offer"),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional().default("other"),
  availability: z.string().max(200).optional(),
  locationMode: z.enum(["in_person", "remote", "hybrid"]).optional().default("remote"),
  exchangePreference: z.enum(["free", "barter", "paid_later", "open_to_discuss"]).optional().default("free"),
  estimatedValue: z.number().positive().optional(),
  visibilityScope: z.enum(["whole_circle", "selected_members", "admins_only"]).optional().default("whole_circle"),
});

const updateServiceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  availability: z.string().max(200).optional(),
  locationMode: z.enum(["in_person", "remote", "hybrid"]).optional(),
  exchangePreference: z.enum(["free", "barter", "paid_later", "open_to_discuss"]).optional(),
  estimatedValue: z.number().positive().optional(),
  status: z.enum(["open", "matched", "in_progress", "completed", "withdrawn", "archived"]).optional(),
  visibilityScope: z.enum(["whole_circle", "selected_members", "admins_only"]).optional(),
});

const createMatchSchema = z.object({
  note: z.string().max(1000).optional(),
});

async function assertCircleMember(circleId: number, userId: number) {
  return db
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
    .then((r) => r[0] ?? null);
}

async function getUserName(userId: number) {
  return db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((r) => r[0]?.displayName ?? "Unknown");
}

function serviceToApi(post: ServicePost, createdByName: string) {
  return {
    id: post.id,
    circleId: post.circleId,
    createdByUserId: post.createdByUserId,
    createdByName,
    serviceType: post.serviceType,
    title: post.title,
    description: post.description,
    category: post.category,
    availability: post.availability,
    locationMode: post.locationMode,
    exchangePreference: post.exchangePreference,
    estimatedValue: post.estimatedValue ? parseFloat(post.estimatedValue) : null,
    status: post.status,
    visibilityScope: post.visibilityScope,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

router.get("/circles/:circleId/services", requireAuth, validateParams(circleIdParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));
  const { serviceType, category, status } = req.query;

  const member = await assertCircleMember(circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const isAdminOrOwner = ["owner", "admin"].includes(member.role);

  const rows = await db
    .select({ post: servicePostsTable, user: usersTable })
    .from(servicePostsTable)
    .innerJoin(usersTable, eq(servicePostsTable.createdByUserId, usersTable.id))
    .where(eq(servicePostsTable.circleId, circleId));

  let filtered = rows.filter((r) => {
    const scope = r.post.visibilityScope;
    if (scope === "admins_only") return isAdminOrOwner || r.post.createdByUserId === userId;
    if (scope === "selected_members") return isAdminOrOwner || r.post.createdByUserId === userId;
    return true;
  });

  if (serviceType) {
    filtered = filtered.filter((r) => r.post.serviceType === serviceType);
  }
  if (category) {
    filtered = filtered.filter((r) => r.post.category === category);
  }
  if (status) {
    filtered = filtered.filter((r) => r.post.status === status);
  }

  res.json(filtered.map((r) => serviceToApi(r.post, r.user.displayName)));
});

router.post("/circles/:circleId/services", requireAuth, validateBody(createServiceSchema), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const member = await assertCircleMember(circleId, userId);
  if (!member) {
    res.status(403).json({ error: "Not a member of this circle" });
    return;
  }

  const {
    serviceType = "offer",
    title,
    description,
    category = "other",
    availability,
    locationMode = "remote",
    exchangePreference = "free",
    estimatedValue,
    visibilityScope = "whole_circle",
  } = req.body;

  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const [post] = await db
    .insert(servicePostsTable)
    .values({
      circleId,
      createdByUserId: userId,
      serviceType,
      title,
      description,
      category,
      availability,
      locationMode,
      exchangePreference,
      estimatedValue: estimatedValue ? String(estimatedValue) : null,
      status: "open",
      visibilityScope,
    })
    .returning();

  const userName = await getUserName(userId);

  await db.insert(activityFeedItemsTable).values({
    circleId,
    actorUserId: userId,
    activityType: "service_posted",
    targetEntityType: "service_post",
    targetEntityId: post.id,
    summaryText: `${userName} ${serviceType === "offer" ? "offered" : "requested"}: "${title}"`,
  });

  res.status(201).json(serviceToApi(post, userName));
});

router.get("/services/:serviceId", requireAuth, validateParams(serviceIdParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const serviceId = parseInt(String(req.params.serviceId));

  const [row] = await db
    .select({ post: servicePostsTable, user: usersTable })
    .from(servicePostsTable)
    .innerJoin(usersTable, eq(servicePostsTable.createdByUserId, usersTable.id))
    .where(eq(servicePostsTable.id, serviceId))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Service post not found" });
    return;
  }

  const member = await assertCircleMember(row.post.circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Service post not found" });
    return;
  }

  const isAdminOrOwner = ["owner", "admin"].includes(member.role);
  const scope = row.post.visibilityScope;
  if (
    (scope === "admins_only" && !isAdminOrOwner && row.post.createdByUserId !== userId) ||
    (scope === "selected_members" && !isAdminOrOwner && row.post.createdByUserId !== userId)
  ) {
    res.status(404).json({ error: "Service post not found" });
    return;
  }

  res.json(serviceToApi(row.post, row.user.displayName));
});

router.patch("/services/:serviceId", requireAuth, validateBody(updateServiceSchema), async (req, res) => {
  const userId = req.dbUser!.id;
  const serviceId = parseInt(String(req.params.serviceId));

  const existing = await db
    .select()
    .from(servicePostsTable)
    .where(eq(servicePostsTable.id, serviceId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Service post not found" });
    return;
  }

  const member = await assertCircleMember(existing.circleId, userId);
  if (!member || (existing.createdByUserId !== userId && !["owner", "admin"].includes(member.role))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { title, description, category, availability, locationMode, exchangePreference, estimatedValue, status } = req.body;

  const [updated] = await db
    .update(servicePostsTable)
    .set({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(availability !== undefined && { availability }),
      ...(locationMode !== undefined && { locationMode }),
      ...(exchangePreference !== undefined && { exchangePreference }),
      ...(estimatedValue !== undefined && { estimatedValue: estimatedValue ? String(estimatedValue) : null }),
      ...(status !== undefined && { status }),
    })
    .where(eq(servicePostsTable.id, serviceId))
    .returning();

  const userName = await getUserName(updated.createdByUserId);
  res.json(serviceToApi(updated, userName));
});

router.post("/services/:serviceId/match", requireAuth, validateBody(createMatchSchema), async (req, res) => {
  const userId = req.dbUser!.id;
  const serviceId = parseInt(String(req.params.serviceId));

  const existing = await db
    .select()
    .from(servicePostsTable)
    .where(eq(servicePostsTable.id, serviceId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Service post not found" });
    return;
  }

  const member = await assertCircleMember(existing.circleId, userId);
  if (!member) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { note } = req.body;

  await db.insert(serviceMatchesTable).values({
    servicePostId: serviceId,
    matchedByUserId: userId,
    note: note ?? null,
    status: "pending",
  });

  const [updated] = await db
    .update(servicePostsTable)
    .set({ status: "matched", matchedByUserId: userId })
    .where(eq(servicePostsTable.id, serviceId))
    .returning();

  const userName = await getUserName(userId);
  const creatorName = await getUserName(existing.createdByUserId);

  await db.insert(activityFeedItemsTable).values({
    circleId: existing.circleId,
    actorUserId: userId,
    activityType: "service_matched",
    targetEntityType: "service_post",
    targetEntityId: serviceId,
    summaryText: `${userName} responded to "${existing.title}" by ${creatorName}`,
  });

  res.json(serviceToApi(updated, creatorName));
});

router.get("/circles/:circleId/services/summary", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const member = await assertCircleMember(circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const rows = await db
    .select()
    .from(servicePostsTable)
    .where(eq(servicePostsTable.circleId, circleId));

  const total = rows.length;
  const open = rows.filter((r) => r.status === "open").length;
  const offers = rows.filter((r) => r.serviceType === "offer" || r.serviceType === "barter_offer").length;
  const requests = rows.filter((r) => r.serviceType === "request" || r.serviceType === "barter_request").length;
  const barter = rows.filter((r) => r.serviceType === "barter_offer" || r.serviceType === "barter_request").length;
  const matched = rows.filter((r) => r.status === "matched" || r.status === "in_progress").length;
  const completed = rows.filter((r) => r.status === "completed").length;

  const categoryCounts: Record<string, number> = {};
  for (const row of rows) {
    const cat = row.category ?? "other";
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  }
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  res.json({
    circleId,
    totalServices: total,
    openServices: open,
    offers,
    requests,
    barterServices: barter,
    matchedServices: matched,
    completedServices: completed,
    topCategories,
  });
});

router.post("/services/:serviceId/complete", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const serviceId = parseInt(String(req.params.serviceId));

  const existing = await db
    .select()
    .from(servicePostsTable)
    .where(eq(servicePostsTable.id, serviceId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Service post not found" });
    return;
  }

  const member = await assertCircleMember(existing.circleId, userId);
  if (!member || (existing.createdByUserId !== userId && !["owner", "admin"].includes(member.role))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(servicePostsTable)
    .set({ status: "completed" })
    .where(eq(servicePostsTable.id, serviceId))
    .returning();

  const creatorName = await getUserName(existing.createdByUserId);

  await db.insert(activityFeedItemsTable).values({
    circleId: existing.circleId,
    actorUserId: userId,
    activityType: "service_completed",
    targetEntityType: "service_post",
    targetEntityId: serviceId,
    summaryText: `"${existing.title}" has been completed`,
  });

  res.json(serviceToApi(updated, creatorName));
});

export default router;
