import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, circleIdParam, paginationQuery, validateQuery } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  commentsTable,
  reactionsTable,
  gratitudeNotesTable,
  usersTable,
  circleMembersTable,
} from "@workspace/db";
import { eq, and, desc, isNull, count, inArray } from "drizzle-orm";
import { assertCircleMember, createNotification } from "../lib/helpers";

const router = Router();

const entityParams = z.object({
  circleId: z.coerce.number().int().positive(),
  entityType: z.enum(["support_request", "service_post"]),
  entityId: z.coerce.number().int().positive(),
});

const commentIdParam = z.object({
  commentId: z.coerce.number().int().positive(),
});

const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
  parentCommentId: z.number().int().positive().optional(),
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
});

function commentToApi(comment: typeof commentsTable.$inferSelect, authorName: string, replyCount?: number) {
  return {
    id: comment.id,
    circleId: comment.circleId,
    authorUserId: comment.authorUserId,
    authorName,
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

    res.json(rows.map((r) => commentToApi(r.comment, r.author?.displayName ?? "Someone", replyCounts[r.comment.id] ?? 0)));
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
    const { body, parentCommentId } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const [comment] = await db
      .insert(commentsTable)
      .values({
        circleId,
        authorUserId: userId,
        targetEntityType: entityType,
        targetEntityId: entityId,
        parentCommentId: parentCommentId ?? null,
        body,
        status: "active",
      })
      .returning();

    const authorName = req.dbUser!.displayName;
    res.status(201).json(commentToApi(comment, authorName));
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

    const isAdminOrOwner = ["owner", "admin"].includes(member.role);
    if (existing.authorUserId !== userId && !isAdminOrOwner) {
      res.status(403).json({ error: "Only the author or an admin can delete this comment" });
      return;
    }

    await db
      .update(commentsTable)
      .set({ status: "deleted", deletedAt: new Date() })
      .where(eq(commentsTable.id, commentId));

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

    const existing = await db
      .select()
      .from(reactionsTable)
      .where(
        and(
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
    const { message, targetEntityType, targetEntityId, recipientUserIds } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const [note] = await db
      .insert(gratitudeNotesTable)
      .values({
        circleId,
        senderUserId: userId,
        targetEntityType,
        targetEntityId,
        recipientUserIds: JSON.stringify(recipientUserIds),
        message,
      })
      .returning();

    const senderName = req.dbUser!.displayName;
    for (const recipientId of recipientUserIds) {
      await createNotification({
        userId: recipientId,
        circleId,
        notificationType: "gratitude_received",
        title: "You received a gratitude note",
        body: `${senderName} sent you a thank-you: "${message.slice(0, 80)}${message.length > 80 ? "…" : ""}"`,
        targetEntityType,
        targetEntityId,
      });
    }

    res.status(201).json({
      id: note.id,
      circleId: note.circleId,
      senderUserId: note.senderUserId,
      targetEntityType: note.targetEntityType,
      targetEntityId: note.targetEntityId,
      recipientUserIds,
      message: note.message,
      createdAt: note.createdAt,
    });
  },
);

export default router;
