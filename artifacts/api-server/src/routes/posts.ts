import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, validateQuery, circleIdParam, paginationQuery } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  circlePostsTable,
  circleMembersTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { assertCircleMember } from "../lib/helpers";

const router = Router();

const postIdParam = z.object({
  postId: z.coerce.number().int().positive(),
  circleId: z.coerce.number().int().positive(),
});

const createPostSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
  imageObjectPath: z.string().max(1000).optional(),
});

function postToApi(
  post: typeof circlePostsTable.$inferSelect,
  authorName: string,
  commentCount: number,
  authorAvatarObjectPath: string | null = null,
) {
  return {
    id: post.id,
    circleId: post.circleId,
    authorUserId: post.authorUserId,
    authorName,
    authorAvatarObjectPath,
    title: post.title,
    body: post.body,
    imageObjectPath: post.imageObjectPath,
    status: post.status,
    commentCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
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

    res.json(
      rows.map((r) =>
        postToApi(r.post, r.author?.displayName ?? "Someone", 0, r.author?.avatarObjectPath ?? null),
      ),
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
    const { title, body, imageObjectPath } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const [post] = await db
      .insert(circlePostsTable)
      .values({
        circleId,
        authorUserId: userId,
        title: title ?? null,
        body,
        imageObjectPath: imageObjectPath ?? null,
        status: "active",
      })
      .returning();

    res.status(201).json(postToApi(post, req.dbUser!.displayName, 0, req.dbUser!.avatarObjectPath));
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

    const isOwnerOrAdmin = ["owner", "admin"].includes(member.role);
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
