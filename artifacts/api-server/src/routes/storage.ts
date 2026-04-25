import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import { registerPendingUpload } from "../lib/uploadTokens";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import {
  attachmentsTable,
  circleMembersTable,
  usersTable,
  circlePostsTable,
  circlesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { isPlus } from "../lib/revenuecat";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * Requires authentication — only circle members may upload files.
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields (name, size, contentType, circleId)" });
    return;
  }

  const userId = req.dbUser!.id;
  const { circleId } = parsed.data;

  const membership = await db
    .select({ id: circleMembersTable.id })
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

  if (!membership) {
    res.status(403).json({ error: "You must be an active member of this circle to upload files" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    registerPendingUpload(objectPath, userId, circleId);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    logger.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /storage/avatar/request-url
 *
 * Request a presigned URL for avatar image upload.
 * Only requires authentication — no circle membership check.
 */
router.post("/storage/avatar/request-url", requireAuth, async (req: Request, res: Response) => {
  const userId = req.dbUser!.id;
  const { name, size, contentType } = req.body as { name?: string; size?: number; contentType?: string };

  if (!name || !size || !contentType) {
    res.status(400).json({ error: "Missing required fields: name, size, contentType" });
    return;
  }

  if (!contentType.startsWith("image/")) {
    res.status(400).json({ error: "Only image files are allowed for avatars" });
    return;
  }

  if (size > 5 * 1024 * 1024) {
    res.status(400).json({ error: "Avatar image must be under 5 MB" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    registerPendingUpload(objectPath, userId, -1);

    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    logger.error({ err: error }, "Error generating avatar upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /storage/circle-media/request-url
 *
 * Request a presigned URL for a wall post image upload.
 * Requires active circle membership.
 */
router.post("/storage/circle-media/request-url", requireAuth, async (req: Request, res: Response) => {
  const userId = req.dbUser!.id;
  const { name, size, contentType, circleId } = req.body as {
    name?: string;
    size?: number;
    contentType?: string;
    circleId?: number;
  };

  if (!name || !size || !contentType || !circleId) {
    res.status(400).json({ error: "Missing required fields: name, size, contentType, circleId" });
    return;
  }

  if (!contentType.startsWith("image/")) {
    res.status(400).json({ error: "Only image files are allowed" });
    return;
  }

  if (size > 10 * 1024 * 1024) {
    res.status(400).json({ error: "Image must be under 10 MB" });
    return;
  }

  const membership = await db
    .select({ id: circleMembersTable.id })
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

  if (!membership) {
    res.status(403).json({ error: "You must be a member of this circle to upload media" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    registerPendingUpload(objectPath, userId, circleId);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    logger.error({ err: error }, "Error generating circle media upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /storage/circle-banner/request-url
 *
 * Request a presigned URL for a Plus "Custom circle look" banner image.
 * Requires the caller to be the circle owner AND to have an active
 * Plus entitlement. RevenueCat is the source of truth for Plus state.
 */
router.post(
  "/storage/circle-banner/request-url",
  requireAuth,
  async (req: Request, res: Response) => {
    const userId = req.dbUser!.id;
    const clerkId = req.dbUser!.clerkId;
    const { name, size, contentType, circleId } = req.body as {
      name?: string;
      size?: number;
      contentType?: string;
      circleId?: number;
    };

    if (!name || !size || !contentType || !circleId) {
      res.status(400).json({
        error:
          "Missing required fields: name, size, contentType, circleId",
      });
      return;
    }

    if (!contentType.startsWith("image/")) {
      res.status(400).json({ error: "Only image files are allowed" });
      return;
    }

    if (size > 10 * 1024 * 1024) {
      res.status(400).json({ error: "Banner image must be under 10 MB" });
      return;
    }

    const circle = await db
      .select({ id: circlesTable.id, ownerId: circlesTable.ownerId })
      .from(circlesTable)
      .where(eq(circlesTable.id, circleId))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!circle) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    if (circle.ownerId !== userId) {
      res
        .status(403)
        .json({ error: "Only the circle owner can change the banner." });
      return;
    }

    const ownerHasPlus = await isPlus(clerkId);
    if (!ownerHasPlus) {
      res.status(402).json({
        error: "plus_required",
        reason: "circle_look",
        message:
          "MyZolve Connect Plus is required to customize your circle's look.",
      });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);
      registerPendingUpload(objectPath, userId, circleId);
      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      logger.error({ err: error }, "Error generating circle banner upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/user-media/*
 *
 * Serve user-owned media objects (avatars and wall post images).
 * Requires authentication. Authorization is enforced by verifying the object path
 * is associated with a known entity (user avatar or circle post image) and that
 * the requesting user has access to that entity:
 *   - Avatar: requesting user is the owner, OR shares at least one active circle with the owner.
 *   - Wall post image: requesting user is an active member of the circle that owns the post.
 */
router.get("/storage/user-media/*path", requireAuth, async (req: Request, res: Response) => {
  const raw = req.params.path;
  const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
  const objectPath = `/objects/${wildcardPath}`;
  const userId = req.dbUser!.id;

  try {
    let authorized = false;

    const avatarOwner = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.avatarObjectPath, objectPath))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (avatarOwner) {
      if (avatarOwner.id === userId) {
        authorized = true;
      } else {
        const myMemberships = await db
          .select({ circleId: circleMembersTable.circleId })
          .from(circleMembersTable)
          .where(and(eq(circleMembersTable.userId, userId), eq(circleMembersTable.status, "active")));

        const myCircleIds = myMemberships.map((m) => m.circleId);

        if (myCircleIds.length > 0) {
          const sharedMembership = await db
            .select({ id: circleMembersTable.id })
            .from(circleMembersTable)
            .where(
              and(
                eq(circleMembersTable.userId, avatarOwner.id),
                eq(circleMembersTable.status, "active"),
                inArray(circleMembersTable.circleId, myCircleIds),
              ),
            )
            .limit(1)
            .then((r) => r[0] ?? null);
          authorized = !!sharedMembership;
        }
      }
    }

    if (!authorized) {
      const post = await db
        .select({ circleId: circlePostsTable.circleId })
        .from(circlePostsTable)
        .where(eq(circlePostsTable.imageObjectPath, objectPath))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (post) {
        const membership = await db
          .select({ id: circleMembersTable.id })
          .from(circleMembersTable)
          .where(
            and(
              eq(circleMembersTable.circleId, post.circleId),
              eq(circleMembersTable.userId, userId),
              eq(circleMembersTable.status, "active"),
            ),
          )
          .limit(1)
          .then((r) => r[0] ?? null);
        authorized = !!membership;
      }
    }

    // Plus "Custom circle look" banner: any active member of the
    // owning circle is allowed to see it.
    if (!authorized) {
      const banner = await db
        .select({ circleId: circlesTable.id })
        .from(circlesTable)
        .where(eq(circlesTable.bannerObjectPath, objectPath))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (banner) {
        const membership = await db
          .select({ id: circleMembersTable.id })
          .from(circleMembersTable)
          .where(
            and(
              eq(circleMembersTable.circleId, banner.circleId),
              eq(circleMembersTable.userId, userId),
              eq(circleMembersTable.status, "active"),
            ),
          )
          .limit(1)
          .then((r) => r[0] ?? null);
        authorized = !!membership;
      }
    }

    if (!authorized) {
      res.status(403).json({ error: "You do not have access to this media" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    logger.error({ err: error }, "Error serving user media object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    logger.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private object entities from PRIVATE_OBJECT_DIR.
 * Requires authentication. Access is granted only if the authenticated user
 * is an active member of the circle that owns the attachment with this storageKey.
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const userId = req.dbUser!.id;

    const attachment = await db
      .select({ circleId: attachmentsTable.circleId })
      .from(attachmentsTable)
      .where(
        and(
          eq(attachmentsTable.storageKey, objectPath),
          eq(attachmentsTable.status, "active"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!attachment) {
      res.status(404).json({ error: "Object not found" });
      return;
    }

    const membership = await db
      .select({ id: circleMembersTable.id })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, attachment.circleId),
          eq(circleMembersTable.userId, userId),
          eq(circleMembersTable.status, "active"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      logger.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    logger.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
