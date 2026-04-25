import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, circleIdParam } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  copilotGrantsTable,
  circleMembersTable,
  circlesTable,
  usersTable,
  supportRequestsTable,
  commentsTable,
  gratitudeNotesTable,
  circlePostsTable,
} from "@workspace/db";
import { eq, and, or, inArray } from "drizzle-orm";
import { assertCircleMember, createNotification, createAuditLog, getUserName } from "../lib/helpers";

const router = Router();

const grantIdParam = z.object({ grantId: z.coerce.number().int().positive() });

const inviteSchema = z.object({
  helperUserId: z.number().int().positive(),
});

const reviewSchema = z.object({
  review: z.enum(["approved", "flagged"]),
});

const reviewParams = z.object({
  entityType: z.enum(["support_request", "comment", "gratitude_note", "circle_post"]),
  entityId: z.coerce.number().int().positive(),
});

type EnrichedGrant = {
  id: number;
  circleId: number;
  circleName: string | null;
  grantorUserId: number;
  grantorName: string | null;
  grantorAvatarObjectPath: string | null;
  helperUserId: number;
  helperName: string | null;
  helperAvatarObjectPath: string | null;
  status: string;
  invitedAt: Date;
  respondedAt: Date | null;
  revokedAt: Date | null;
};

async function enrichGrants(rows: (typeof copilotGrantsTable.$inferSelect)[]): Promise<EnrichedGrant[]> {
  if (rows.length === 0) return [];
  const userIds = Array.from(new Set(rows.flatMap((r) => [r.grantorUserId, r.helperUserId])));
  const circleIds = Array.from(new Set(rows.map((r) => r.circleId)));
  const [users, circles] = await Promise.all([
    db
      .select({ id: usersTable.id, displayName: usersTable.displayName, avatarObjectPath: usersTable.avatarObjectPath })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds)),
    db
      .select({ id: circlesTable.id, name: circlesTable.name })
      .from(circlesTable)
      .where(inArray(circlesTable.id, circleIds)),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const circleMap = new Map(circles.map((c) => [c.id, c]));
  return rows.map((r) => {
    const grantor = userMap.get(r.grantorUserId);
    const helper = userMap.get(r.helperUserId);
    const circle = circleMap.get(r.circleId);
    return {
      id: r.id,
      circleId: r.circleId,
      circleName: circle?.name ?? null,
      grantorUserId: r.grantorUserId,
      grantorName: grantor?.displayName ?? null,
      grantorAvatarObjectPath: grantor?.avatarObjectPath ?? null,
      helperUserId: r.helperUserId,
      helperName: helper?.displayName ?? null,
      helperAvatarObjectPath: helper?.avatarObjectPath ?? null,
      status: r.status,
      invitedAt: r.invitedAt,
      respondedAt: r.respondedAt ?? null,
      revokedAt: r.revokedAt ?? null,
    };
  });
}

async function fetchGrantsForUser(
  userId: number,
  circleId?: number,
): Promise<{ peopleWhoHelpMe: EnrichedGrant[]; peopleIHelp: EnrichedGrant[] }> {
  const baseFilter = circleId
    ? and(
        eq(copilotGrantsTable.circleId, circleId),
        or(
          eq(copilotGrantsTable.grantorUserId, userId),
          eq(copilotGrantsTable.helperUserId, userId),
        ),
      )
    : or(
        eq(copilotGrantsTable.grantorUserId, userId),
        eq(copilotGrantsTable.helperUserId, userId),
      );
  const rows = await db.select().from(copilotGrantsTable).where(baseFilter);
  const enriched = await enrichGrants(rows);
  return {
    peopleWhoHelpMe: enriched.filter((g) => g.grantorUserId === userId),
    peopleIHelp: enriched.filter((g) => g.helperUserId === userId),
  };
}

router.get("/copilot/grants", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  res.json(await fetchGrantsForUser(userId));
});

router.get(
  "/circles/:circleId/copilot/grants",
  requireAuth,
  validateParams(circleIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }
    res.json(await fetchGrantsForUser(userId, circleId));
  },
);

router.post(
  "/circles/:circleId/copilot/grants",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(inviteSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const { helperUserId } = req.body as { helperUserId: number };

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }
    if (helperUserId === userId) {
      res.status(400).json({ error: "You cannot invite yourself as a co-pilot" });
      return;
    }
    const helperMember = await assertCircleMember(circleId, helperUserId);
    if (!helperMember) {
      res.status(400).json({ error: "Helper must be an active member of this circle" });
      return;
    }

    const existing = await db
      .select()
      .from(copilotGrantsTable)
      .where(
        and(
          eq(copilotGrantsTable.circleId, circleId),
          eq(copilotGrantsTable.grantorUserId, userId),
          eq(copilotGrantsTable.helperUserId, helperUserId),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    let grant;
    if (existing) {
      if (existing.status === "active" || existing.status === "pending") {
        res.status(409).json({ error: `A ${existing.status} co-pilot grant already exists` });
        return;
      }
      const [updated] = await db
        .update(copilotGrantsTable)
        .set({
          status: "pending",
          invitedAt: new Date(),
          respondedAt: null,
          revokedAt: null,
          revokedByUserId: null,
        })
        .where(eq(copilotGrantsTable.id, existing.id))
        .returning();
      grant = updated;
    } else {
      const [inserted] = await db
        .insert(copilotGrantsTable)
        .values({ circleId, grantorUserId: userId, helperUserId, status: "pending" })
        .returning();
      grant = inserted;
    }

    const grantorName = req.dbUser!.displayName;
    await createNotification({
      userId: helperUserId,
      circleId,
      notificationType: "copilot_invite_received",
      title: `${grantorName} invited you to be their co-pilot`,
      body: "You'll be able to post requests, comments, and notes on their behalf.",
      targetEntityType: "copilot_grant",
      targetEntityId: grant.id,
    });
    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: "copilot_grant_invited",
      targetEntityType: "copilot_grant",
      targetEntityId: grant.id,
      metadata: { helperUserId },
    });

    const [enriched] = await enrichGrants([grant]);
    res.status(201).json(enriched);
  },
);

router.post(
  "/copilot/grants/:grantId/accept",
  requireAuth,
  validateParams(grantIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const grantId = parseInt(String(req.params.grantId));
    const grant = await db
      .select()
      .from(copilotGrantsTable)
      .where(eq(copilotGrantsTable.id, grantId))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!grant) {
      res.status(404).json({ error: "Grant not found" });
      return;
    }
    if (grant.helperUserId !== userId) {
      res.status(403).json({ error: "Only the invited helper can accept this grant" });
      return;
    }
    if (grant.status !== "pending") {
      res.status(400).json({ error: `Grant is already ${grant.status}` });
      return;
    }
    const [updated] = await db
      .update(copilotGrantsTable)
      .set({ status: "active", respondedAt: new Date() })
      .where(eq(copilotGrantsTable.id, grantId))
      .returning();

    const helperName = req.dbUser!.displayName;
    await createNotification({
      userId: grant.grantorUserId,
      circleId: grant.circleId,
      notificationType: "copilot_invite_received",
      title: `${helperName} is now your co-pilot`,
      body: "They can now post on your behalf in this circle.",
      targetEntityType: "copilot_grant",
      targetEntityId: grant.id,
    });
    await createAuditLog({
      circleId: grant.circleId,
      actorUserId: userId,
      action: "copilot_grant_accepted",
      targetEntityType: "copilot_grant",
      targetEntityId: grant.id,
    });
    const [enriched] = await enrichGrants([updated]);
    res.json(enriched);
  },
);

router.post(
  "/copilot/grants/:grantId/decline",
  requireAuth,
  validateParams(grantIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const grantId = parseInt(String(req.params.grantId));
    const grant = await db
      .select()
      .from(copilotGrantsTable)
      .where(eq(copilotGrantsTable.id, grantId))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!grant) {
      res.status(404).json({ error: "Grant not found" });
      return;
    }
    if (grant.helperUserId !== userId) {
      res.status(403).json({ error: "Only the invited helper can decline this grant" });
      return;
    }
    if (grant.status !== "pending") {
      res.status(400).json({ error: `Grant is already ${grant.status}` });
      return;
    }
    const [updated] = await db
      .update(copilotGrantsTable)
      .set({ status: "declined", respondedAt: new Date() })
      .where(eq(copilotGrantsTable.id, grantId))
      .returning();
    await createAuditLog({
      circleId: grant.circleId,
      actorUserId: userId,
      action: "copilot_grant_declined",
      targetEntityType: "copilot_grant",
      targetEntityId: grant.id,
    });
    const [enriched] = await enrichGrants([updated]);
    res.json(enriched);
  },
);

router.post(
  "/copilot/grants/:grantId/revoke",
  requireAuth,
  validateParams(grantIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const grantId = parseInt(String(req.params.grantId));
    const grant = await db
      .select()
      .from(copilotGrantsTable)
      .where(eq(copilotGrantsTable.id, grantId))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!grant) {
      res.status(404).json({ error: "Grant not found" });
      return;
    }
    if (grant.grantorUserId !== userId && grant.helperUserId !== userId) {
      res.status(403).json({ error: "Only the grantor or helper can revoke this grant" });
      return;
    }
    if (grant.status === "revoked" || grant.status === "declined") {
      res.status(400).json({ error: `Grant is already ${grant.status}` });
      return;
    }
    const [updated] = await db
      .update(copilotGrantsTable)
      .set({ status: "revoked", revokedAt: new Date(), revokedByUserId: userId })
      .where(eq(copilotGrantsTable.id, grantId))
      .returning();

    const otherUserId = grant.grantorUserId === userId ? grant.helperUserId : grant.grantorUserId;
    const actorName = await getUserName(userId);
    await createNotification({
      userId: otherUserId,
      circleId: grant.circleId,
      notificationType: "copilot_invite_received",
      title: `${actorName} revoked a co-pilot relationship`,
      body: "Tap to view your co-pilot settings.",
      targetEntityType: "copilot_grant",
      targetEntityId: grant.id,
    });
    await createAuditLog({
      circleId: grant.circleId,
      actorUserId: userId,
      action: "copilot_grant_revoked",
      targetEntityType: "copilot_grant",
      targetEntityId: grant.id,
    });
    const [enriched] = await enrichGrants([updated]);
    res.json(enriched);
  },
);

router.post(
  "/copilot/posts/:entityType/:entityId/review",
  requireAuth,
  validateParams(reviewParams),
  validateBody(reviewSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { entityType, entityId } = req.params as unknown as { entityType: string; entityId: number };
    const { review } = req.body as { review: "approved" | "flagged" };

    let table: typeof supportRequestsTable | typeof commentsTable | typeof gratitudeNotesTable | typeof circlePostsTable;
    if (entityType === "support_request") table = supportRequestsTable;
    else if (entityType === "comment") table = commentsTable;
    else if (entityType === "gratitude_note") table = gratitudeNotesTable;
    else table = circlePostsTable;

    const row = await db
      .select()
      .from(table as typeof supportRequestsTable)
      .where(eq((table as typeof supportRequestsTable).id, entityId))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!row) {
      res.status(404).json({ error: `${entityType} not found` });
      return;
    }
    const actingForUserId = (row as { actingForUserId: number | null }).actingForUserId;
    if (!actingForUserId) {
      res.status(400).json({ error: "This item was not posted via a co-pilot" });
      return;
    }
    if (actingForUserId !== userId) {
      res.status(403).json({ error: "Only the represented member can review this item" });
      return;
    }
    await db
      .update(table as typeof supportRequestsTable)
      .set({ copilotReview: review })
      .where(eq((table as typeof supportRequestsTable).id, entityId));

    await createAuditLog({
      circleId: (row as { circleId: number }).circleId,
      actorUserId: userId,
      action: review === "approved" ? "copilot_post_approved" : "copilot_post_flagged",
      targetEntityType: entityType,
      targetEntityId: entityId,
    });
    res.json({ entityType, entityId, review });
  },
);

export default router;
