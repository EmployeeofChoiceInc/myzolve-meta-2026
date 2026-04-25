import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, validateQuery, circleIdParam, paginationQuery } from "../middlewares/validate";
import { canManagePosts } from "../lib/permissions";
import { db } from "@workspace/db";
import {
  circlePostsTable,
  circleMembersTable,
  usersTable,
  commentsTable,
} from "@workspace/db";
import { eq, and, desc, count, inArray, sql } from "drizzle-orm";
import { assertCircleMember, notifyMentions, resolveActingFor, createNotification } from "../lib/helpers";
import { validateAndConsumePendingUpload } from "../lib/uploadTokens";

const router = Router();

const postIdParam = z.object({
  postId: z.coerce.number().int().positive(),
  circleId: z.coerce.number().int().positive(),
});

const createPostSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
  imageObjectPath: z.string().max(1000).optional(),
  actingForUserId: z.number().int().positive().optional(),
});

function postToApi(
  post: typeof circlePostsTable.$inferSelect,
  authorName: string,
  commentCount: number,
  authorAvatarObjectPath: string | null = null,
  actingFor?: { name: string | null; avatarObjectPath: string | null } | null,
) {
  return {
    id: post.id,
    circleId: post.circleId,
    authorUserId: post.authorUserId,
    authorName,
    authorAvatarObjectPath,
    actingForUserId: post.actingForUserId ?? null,
    actingForName: actingFor?.name ?? null,
    actingForAvatarObjectPath: actingFor?.avatarObjectPath ?? null,
    copilotReview: post.copilotReview ?? null,
    title: post.title,
    body: post.body,
    imageObjectPath: post.imageObjectPath,
    status: post.status,
    commentCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
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

router.get(
  "/circles/:circleId/posts",
  requireAuth,
  validateParams(circleIdParam),
  validateQuery(paginationQuery),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const { limit, offset } = req.query as unknown as { limit: number; offset: number };

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const rows = await db
      .select({ post: circlePostsTable, author: usersTable })
      .from(circlePostsTable)
      .leftJoin(usersTable, eq(circlePostsTable.authorUserId, usersTable.id))
      .where(
        and(
          eq(circlePostsTable.circleId, circleId),
          eq(circlePostsTable.status, "active"),
        ),
      )
      .orderBy(desc(circlePostsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const postIds = rows.map((r) => r.post.id);
    const commentCounts: Record<number, number> = {};
    if (postIds.length > 0) {
      const counts = await db
        .select({ targetEntityId: commentsTable.targetEntityId, cnt: count() })
        .from(commentsTable)
        .where(
          and(
            eq(commentsTable.targetEntityType, "circle_post"),
            eq(commentsTable.circleId, circleId),
            inArray(commentsTable.targetEntityId, postIds),
          ),
        )
        .groupBy(commentsTable.targetEntityId);
      for (const row of counts) {
        if (row.targetEntityId !== null) commentCounts[row.targetEntityId] = Number(row.cnt);
      }
    }

    const actingForMap = await loadActingForMap(rows.map((r) => r.post.actingForUserId));
    res.json(
      rows.map((r) => {
        const af = r.post.actingForUserId ? actingForMap.get(r.post.actingForUserId) ?? null : null;
        return postToApi(
          r.post,
          r.author?.displayName ?? "Someone",
          commentCounts[r.post.id] ?? 0,
          r.author?.avatarObjectPath ?? null,
          af,
        );
      }),
    );
  },
);

router.post(
  "/circles/:circleId/posts",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(createPostSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const { title, body, imageObjectPath, actingForUserId } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    if (imageObjectPath !== undefined) {
      const valid = validateAndConsumePendingUpload(imageObjectPath, userId, circleId);
      if (!valid) {
        res.status(400).json({
          error: "Invalid image: the upload token is missing, expired, or does not belong to this circle. Please re-upload your photo.",
        });
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

    const [post] = await db
      .insert(circlePostsTable)
      .values({
        circleId,
        authorUserId: userId,
        actingForUserId: actingFor?.actingForUserId ?? null,
        copilotReview: actingFor ? "pending" : null,
        title: title ?? null,
        body,
        imageObjectPath: imageObjectPath ?? null,
        status: "active",
      })
      .returning();

    const authorName = req.dbUser!.displayName;
    const attribution = actingFor ? `${authorName} (for ${actingFor.actingForName})` : authorName;

    await notifyMentions({
      circleId,
      body,
      actorUserId: userId,
      actorName: attribution,
      targetEntityType: "circle_post",
      targetEntityId: post.id,
      context: "in a wall post",
    });

    if (actingFor) {
      await createNotification({
        userId: actingFor.actingForUserId,
        circleId,
        notificationType: "copilot_post_made",
        title: `${authorName} posted on the wall for you`,
        body: title ? `"${title}"` : `"${body.slice(0, 120)}${body.length > 120 ? "…" : ""}"`,
        targetEntityType: "circle_post",
        targetEntityId: post.id,
      });
    }

    const actingForInfo = actingFor ? { name: actingFor.actingForName, avatarObjectPath: null } : null;
    res.status(201).json(postToApi(post, authorName, 0, req.dbUser!.avatarObjectPath, actingForInfo));
  },
);

router.delete(
  "/circles/:circleId/posts/:postId",
  requireAuth,
  validateParams(postIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const postId = parseInt(String(req.params.postId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const post = await db
      .select()
      .from(circlePostsTable)
      .where(
        and(
          eq(circlePostsTable.id, postId),
          eq(circlePostsTable.circleId, circleId),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const isOwnerOrAdmin = canManagePosts(member.role);
    if (post.authorUserId !== userId && !isOwnerOrAdmin) {
      res.status(403).json({ error: "Only the author or circle admin can delete this post" });
      return;
    }

    await db
      .update(circlePostsTable)
      .set({ status: "deleted" })
      .where(eq(circlePostsTable.id, postId));

    res.status(204).end();
  },
);

export default router;
