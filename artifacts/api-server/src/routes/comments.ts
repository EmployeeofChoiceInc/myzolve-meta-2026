import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, circleIdParam, paginationQuery, validateQuery } from "../middlewares/validate";
import { canManagePosts } from "../lib/permissions";
import { db } from "@workspace/db";
import {
  commentsTable,
  reactionsTable,
  gratitudeNotesTable,
  usersTable,
  circleMembersTable,
  supportRequestsTable,
  servicePostsTable,
  circlePostsTable,
} from "@workspace/db";
import { eq, and, desc, isNull, count, inArray, sql } from "drizzle-orm";
import { assertCircleMember, createNotification, notifyMentions, resolveActingFor, getBlockedUserIdSet } from "../lib/helpers";

const router = Router();

const entityParams = z.object({
  circleId: z.coerce.number().int().positive(),
  entityType: z.enum(["support_request", "service_post", "circle_post"]),
  entityId: z.coerce.number().int().positive(),
});

const commentIdParam = z.object({
  commentId: z.coerce.number().int().positive(),
});

const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
  parentCommentId: z.number().int().positive().optional(),
  actingForUserId: z.number().int().positive().optional(),
});

const updateCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

const reactionSchema = z.object({
  reactionType: z.enum(["heart", "support", "thank_you", "got_it"]),
});

const gratitudeNoteSchema = z.object({
  message: z.string().min(1).max(2000),
  targetEntityType: z.enum(["support_request", "service_post"]),
  targetEntityId: z.number().int().positive(),
  recipientUserIds: z.array(z.number().int().positive()).min(1),
  actingForUserId: z.number().int().positive().optional(),
});

function commentToApi(
  comment: typeof commentsTable.$inferSelect,
  authorName: string,
  replyCount?: number,
  actingFor?: { name: string | null; avatarObjectPath: string | null } | null,
) {
  return {
    id: comment.id,
    circleId: comment.circleId,
    authorUserId: comment.authorUserId,
    authorName,
    actingForUserId: comment.actingForUserId ?? null,
    actingForName: actingFor?.name ?? null,
    actingForAvatarObjectPath: actingFor?.avatarObjectPath ?? null,
    copilotReview: comment.copilotReview ?? null,
    targetEntityType: comment.targetEntityType,
    targetEntityId: comment.targetEntityId,
    parentCommentId: comment.parentCommentId,
    body: comment.body,
    status: comment.status,
    replyCount: replyCount ?? 0,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

async function loadActingForMap(userIds: (number | null | undefined)[]) {
  const ids = Array.from(new Set(userIds.filter((v): v is number => typeof v === "number" && v > 0)));
  if (ids.length === 0) return new Map<number, { name: string | null; avatarObjectPath: string | null }>();
  const rows = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, avatarObjectPath: usersTable.avatarObjectPath })
    .from(usersTable)
    .where(sql`${usersTable.id} = ANY(${ids})`);
  return new Map(rows.map((r) => [r.id, { name: r.displayName, avatarObjectPath: r.avatarObjectPath ?? null }]));
}

async function assertEntityInCircle(
  circleId: number,
  entityType: string,
  entityId: number,
): Promise<{ ownerId: number | null } | null> {
  if (entityType === "support_request") {
    const row = await db
      .select({ id: supportRequestsTable.id, createdByUserId: supportRequestsTable.createdByUserId })
      .from(supportRequestsTable)
      .where(and(eq(supportRequestsTable.id, entityId), eq(supportRequestsTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!row) return null;
    return { ownerId: row.createdByUserId };
  }
  if (entityType === "service_post") {
    const row = await db
      .select({ id: servicePostsTable.id, createdByUserId: servicePostsTable.createdByUserId })
      .from(servicePostsTable)
      .where(and(eq(servicePostsTable.id, entityId), eq(servicePostsTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!row) return null;
    return { ownerId: row.createdByUserId };
  }
  if (entityType === "circle_post") {
    const row = await db
      .select({ id: circlePostsTable.id, authorUserId: circlePostsTable.authorUserId })
      .from(circlePostsTable)
      .where(and(eq(circlePostsTable.id, entityId), eq(circlePostsTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!row) return null;
    return { ownerId: row.authorUserId };
  }
  return null;
}

/**
 * GET /circles/:circleId/comments/:commentId/replies
 * MUST be registered BEFORE /:entityType/:entityId to avoid route shadowing.
 */
router.get(
  "/circles/:circleId/comments/:commentId/replies",
  requireAuth,
  validateParams(circleIdParam.merge(commentIdParam)),
  validateQuery(paginationQuery),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const commentId = parseInt(String(req.params.commentId));
    const { limit, offset } = req.query as unknown as { limit: number; offset: number };

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const parent = await db
      .select()
      .from(commentsTable)
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!parent) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    const rows = await db
      .select({ comment: commentsTable, author: usersTable })
      .from(commentsTable)
      .leftJoin(usersTable, eq(commentsTable.authorUserId, usersTable.id))
      .where(
        and(
          eq(commentsTable.circleId, circleId),
          eq(commentsTable.parentCommentId, commentId),
          eq(commentsTable.status, "active"),
        ),
      )
      .orderBy(desc(commentsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const actingForMap = await loadActingForMap(rows.map((r) => r.comment.actingForUserId));
    res.json(
      rows.map((r) => {
        const af = r.comment.actingForUserId ? actingForMap.get(r.comment.actingForUserId) ?? null : null;
        return commentToApi(r.comment, r.author?.displayName ?? "Someone", undefined, af);
      }),
    );
  },
);

/**
 * GET /circles/:circleId/comments/:entityType/:entityId
 * Registered AFTER the replies route to prevent shadowing.
 */
router.get(
  "/circles/:circleId/comments/:entityType/:entityId",
  requireAuth,
  validateParams(entityParams),
  validateQuery(paginationQuery),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { circleId, entityType, entityId } = req.params as unknown as { circleId: number; entityType: string; entityId: number };
    const { limit, offset } = req.query as unknown as { limit: number; offset: number };

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const rows = await db
      .select({ comment: commentsTable, author: usersTable })
      .from(commentsTable)
      .leftJoin(usersTable, eq(commentsTable.authorUserId, usersTable.id))
      .where(
        and(
          eq(commentsTable.circleId, circleId),
          eq(commentsTable.targetEntityType, entityType),
          eq(commentsTable.targetEntityId, entityId),
          isNull(commentsTable.parentCommentId),
          eq(commentsTable.status, "active"),
        ),
      )
      .orderBy(desc(commentsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const parentIds = rows.map((r) => r.comment.id);
    const replyCounts: Record<number, number> = {};

    if (parentIds.length > 0) {
      const replyRows = await db
        .select({ parentCommentId: commentsTable.parentCommentId, replyCount: count() })
        .from(commentsTable)
        .where(
          and(
            inArray(commentsTable.parentCommentId, parentIds),
            eq(commentsTable.status, "active"),
          ),
        )
        .groupBy(commentsTable.parentCommentId);

      for (const r of replyRows) {
        if (r.parentCommentId !== null) {
          replyCounts[r.parentCommentId] = Number(r.replyCount);
        }
      }
    }

    const actingForMap = await loadActingForMap(rows.map((r) => r.comment.actingForUserId));
    res.json(
      rows.map((r) => {
        const af = r.comment.actingForUserId ? actingForMap.get(r.comment.actingForUserId) ?? null : null;
        return commentToApi(r.comment, r.author?.displayName ?? "Someone", replyCounts[r.comment.id] ?? 0, af);
      }),
    );
  },
);

router.post(
  "/circles/:circleId/comments/:entityType/:entityId",
  requireAuth,
  validateParams(entityParams),
  validateBody(createCommentSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { circleId, entityType, entityId } = req.params as unknown as { circleId: number; entityType: string; entityId: number };
    const { body, parentCommentId, actingForUserId } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const entity = await assertEntityInCircle(circleId, entityType, entityId);
    if (!entity) {
      res.status(404).json({ error: `${entityType.replace("_", " ")} not found in this circle` });
      return;
    }

    if (parentCommentId != null) {
      const parentComment = await db
        .select({ id: commentsTable.id })
        .from(commentsTable)
        .where(
          and(
            eq(commentsTable.id, parentCommentId),
            eq(commentsTable.circleId, circleId),
            eq(commentsTable.targetEntityType, entityType),
            eq(commentsTable.targetEntityId, entityId),
            eq(commentsTable.status, "active"),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!parentComment) {
        res.status(404).json({ error: "Parent comment not found in this entity" });
        return;
      }
    }

    let actingFor: { actingForUserId: number; actingForName: string } | null = null;
    if (actingForUserId) {
      try {
        actingFor = await resolveActingFor({ circleId, helperUserId: userId, actingForUserId });
      } catch (e) {
        res.status(403).json({ error: e instanceof Error ? e.message : "Co-pilot check failed" });
        return;
      }
    }

    const [comment] = await db
      .insert(commentsTable)
      .values({
        circleId,
        authorUserId: userId,
        actingForUserId: actingFor?.actingForUserId ?? null,
        copilotReview: actingFor ? "pending" : null,
        targetEntityType: entityType,
        targetEntityId: entityId,
        parentCommentId: parentCommentId ?? null,
        body,
        status: "active",
      })
      .returning();

    const authorName = req.dbUser!.displayName;
    const attribution = actingFor ? `${authorName} (for ${actingFor.actingForName})` : authorName;

    if (entity.ownerId && entity.ownerId !== userId) {
      await createNotification({
        userId: entity.ownerId,
        circleId,
        notificationType: "new_comment",
        title: "New comment on your post",
        body: `${attribution}: "${body.slice(0, 120)}${body.length > 120 ? "…" : ""}"`,
        targetEntityType: entityType,
        targetEntityId: entityId,
      });
    }

    await notifyMentions({
      circleId,
      body,
      actorUserId: userId,
      actorName: attribution,
      targetEntityType: entityType,
      targetEntityId: entityId,
      excludeUserIds: entity.ownerId ? [entity.ownerId] : [],
      context: entityType === "circle_post" ? "in a wall comment" : "in a comment",
    });

    if (actingFor) {
      await createNotification({
        userId: actingFor.actingForUserId,
        circleId,
        notificationType: "copilot_post_made",
        title: `${authorName} commented for you`,
        body: `"${body.slice(0, 120)}${body.length > 120 ? "…" : ""}"`,
        targetEntityType: "comment",
        targetEntityId: comment.id,
      });
    }

    const actingForInfo = actingFor ? { name: actingFor.actingForName, avatarObjectPath: null } : null;
    res.status(201).json(commentToApi(comment, authorName, undefined, actingForInfo));
  },
);

router.patch(
  "/circles/:circleId/comments/:commentId",
  requireAuth,
  validateParams(circleIdParam.merge(commentIdParam)),
  validateBody(updateCommentSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const commentId = parseInt(String(req.params.commentId));
    const { body } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const existing = await db
      .select()
      .from(commentsTable)
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    if (existing.authorUserId !== userId) {
      res.status(403).json({ error: "Only the author can edit this comment" });
      return;
    }

    const [updated] = await db
      .update(commentsTable)
      .set({ body })
      .where(eq(commentsTable.id, commentId))
      .returning();

    res.json(commentToApi(updated, req.dbUser!.displayName));
  },
);

router.delete(
  "/circles/:circleId/comments/:commentId",
  requireAuth,
  validateParams(circleIdParam.merge(commentIdParam)),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const commentId = parseInt(String(req.params.commentId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const existing = await db
      .select()
      .from(commentsTable)
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    const isOwnerOrAdmin = canManagePosts(member.role);
    if (existing.authorUserId !== userId && !isOwnerOrAdmin) {
      res.status(403).json({ error: "Only the author or circle admin can delete this comment" });
      return;
    }

    await db.update(commentsTable).set({ status: "deleted" }).where(eq(commentsTable.id, commentId));

    res.status(204).send();
  },
);

router.post(
  "/circles/:circleId/reactions/:entityType/:entityId",
  requireAuth,
  validateParams(entityParams),
  validateBody(reactionSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { circleId, entityType, entityId } = req.params as unknown as { circleId: number; entityType: string; entityId: number };
    const { reactionType } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const entity = await assertEntityInCircle(circleId, entityType, entityId);
    if (!entity) {
      res.status(404).json({ error: `${entityType.replace("_", " ")} not found in this circle` });
      return;
    }

    const existing = await db
      .select()
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.circleId, circleId),
          eq(reactionsTable.userId, userId),
          eq(reactionsTable.targetEntityType, entityType),
          eq(reactionsTable.targetEntityId, entityId),
          eq(reactionsTable.reactionType, reactionType),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (existing) {
      await db.delete(reactionsTable).where(eq(reactionsTable.id, existing.id));
      res.json({ toggled: false, reactionType });
      return;
    }

    await db.insert(reactionsTable).values({
      circleId,
      userId,
      targetEntityType: entityType,
      targetEntityId: entityId,
      reactionType,
    });

    if (entity.ownerId && entity.ownerId !== userId) {
      const reactorName = req.dbUser!.displayName;
      await createNotification({
        userId: entity.ownerId,
        circleId,
        notificationType: "reaction_received",
        title: "Someone reacted to your post",
        body: `${reactorName} reacted with ${reactionType.replace("_", " ")} on your post.`,
        targetEntityType: entityType,
        targetEntityId: entityId,
      });
    }

    res.status(201).json({ toggled: true, reactionType });
  },
);

router.get(
  "/circles/:circleId/reactions/:entityType/:entityId",
  requireAuth,
  validateParams(entityParams),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { circleId, entityType, entityId } = req.params as unknown as { circleId: number; entityType: string; entityId: number };

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const rows = await db
      .select()
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.circleId, circleId),
          eq(reactionsTable.targetEntityType, entityType),
          eq(reactionsTable.targetEntityId, entityId),
        ),
      );

    const counts: Record<string, number> = {};
    const myReactions: string[] = [];
    for (const r of rows) {
      counts[r.reactionType] = (counts[r.reactionType] ?? 0) + 1;
      if (r.userId === userId) myReactions.push(r.reactionType);
    }

    res.json({ counts, myReactions, total: rows.length });
  },
);

router.post(
  "/circles/:circleId/gratitude",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(gratitudeNoteSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const { message, targetEntityType, targetEntityId, recipientUserIds, actingForUserId } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const circleMembers = await db
      .select({ userId: circleMembersTable.userId })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.status, "active"),
        ),
      );
    const memberUserIds = new Set(circleMembers.map((m) => m.userId));
    const invalidRecipients = recipientUserIds.filter((id: number) => !memberUserIds.has(id));
    if (invalidRecipients.length > 0) {
      res.status(400).json({ error: "All recipients must be active members of this circle" });
      return;
    }

    // Block check: filter out anyone the sender has a mutual block with.
    // We refuse the whole request when any recipient is blocked so the
    // sender knows something is wrong instead of silently dropping people.
    const blocked = await getBlockedUserIdSet(userId);
    const blockedRecipients = recipientUserIds.filter((id: number) => blocked.has(id));
    if (blockedRecipients.length > 0) {
      res.status(403).json({
        error: "user_blocked",
        message: "One or more recipients can't receive this note.",
      });
      return;
    }

    let actingFor: { actingForUserId: number; actingForName: string } | null = null;
    if (actingForUserId) {
      try {
        actingFor = await resolveActingFor({ circleId, helperUserId: userId, actingForUserId });
      } catch (e) {
        res.status(403).json({ error: e instanceof Error ? e.message : "Co-pilot check failed" });
        return;
      }
    }

    const [note] = await db
      .insert(gratitudeNotesTable)
      .values({
        circleId,
        senderUserId: userId,
        actingForUserId: actingFor?.actingForUserId ?? null,
        copilotReview: actingFor ? "pending" : null,
        targetEntityType,
        targetEntityId,
        recipientUserIds: JSON.stringify(recipientUserIds),
        message,
      })
      .returning();

    const senderName = req.dbUser!.displayName;
    const attribution = actingFor ? `${senderName} (for ${actingFor.actingForName})` : senderName;
    for (const recipientId of recipientUserIds) {
      await createNotification({
        userId: recipientId,
        circleId,
        notificationType: "gratitude_received",
        title: "You received a gratitude note",
        body: `${attribution} sent you a thank-you: "${message.slice(0, 80)}${message.length > 80 ? "…" : ""}"`,
        targetEntityType,
        targetEntityId,
      });
    }

    if (actingFor) {
      await createNotification({
        userId: actingFor.actingForUserId,
        circleId,
        notificationType: "copilot_post_made",
        title: `${senderName} sent gratitude for you`,
        body: `"${message.slice(0, 120)}${message.length > 120 ? "…" : ""}"`,
        targetEntityType: "gratitude_note",
        targetEntityId: note.id,
      });
    }

    res.status(201).json({
      id: note.id,
      circleId: note.circleId,
      senderUserId: note.senderUserId,
      senderName,
      actingForUserId: note.actingForUserId ?? null,
      actingForName: actingFor?.actingForName ?? null,
      copilotReview: note.copilotReview ?? null,
      targetEntityType: note.targetEntityType,
      targetEntityId: note.targetEntityId,
      recipientUserIds,
      message: note.message,
      createdAt: note.createdAt,
    });
  },
);

export default router;
