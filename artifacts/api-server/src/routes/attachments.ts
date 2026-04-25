import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  attachmentsTable,
  supportRequestsTable,
  servicePostsTable,
  repaymentsTable,
  circlePostsTable,
  commentsTable,
  gratitudeNotesTable,
} from "@workspace/db";
import { eq, and, isNull, count } from "drizzle-orm";
import { assertCircleMember, createAuditLog } from "../lib/helpers";
import { ObjectStorageService } from "../lib/objectStorage";
import {
  validateAndConsumeMediaUpload,
  validateAndConsumePendingUpload,
  type MediaPolicy,
} from "../lib/uploadTokens";
import { isPlus } from "../lib/revenuecat";

// Legacy /storage/uploads/request-url tokens carry no media policy. For
// backwards compatibility we still accept them for *photos* and apply the
// same per-file caps server-side as if they had come through the
// policy-enforcing endpoint.
const LEGACY_PHOTO_FREE_BYTES = 10 * 1024 * 1024;
const LEGACY_PHOTO_PLUS_BYTES = 50 * 1024 * 1024;

// Photo caps per attachable entity. Free members can attach up to 3 photos
// per request/post; Plus members can attach up to 8.
const FREE_PHOTO_CAP = 3;
const PLUS_PHOTO_CAP = 8;

// Hard duration ceilings, mirrored on the client. We trust the client's
// reported duration but cap it server-side as a safety net.
const MAX_VOICE_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const MAX_VIDEO_DURATION_MS = 30 * 1000; // 30 seconds

async function assertAttachmentEntityInCircle(circleId: number, entityType: string, entityId: number): Promise<boolean> {
  if (entityType === "support_request") {
    const [row] = await db.select({ id: supportRequestsTable.id }).from(supportRequestsTable)
      .where(and(eq(supportRequestsTable.id, entityId), eq(supportRequestsTable.circleId, circleId))).limit(1);
    return !!row;
  }
  if (entityType === "service_post") {
    const [row] = await db.select({ id: servicePostsTable.id }).from(servicePostsTable)
      .where(and(eq(servicePostsTable.id, entityId), eq(servicePostsTable.circleId, circleId))).limit(1);
    return !!row;
  }
  if (entityType === "repayment") {
    const [row] = await db
      .select({ id: repaymentsTable.id })
      .from(repaymentsTable)
      .innerJoin(supportRequestsTable, eq(supportRequestsTable.id, repaymentsTable.requestId))
      .where(and(eq(repaymentsTable.id, entityId), eq(supportRequestsTable.circleId, circleId)))
      .limit(1);
    return !!row;
  }
  if (entityType === "circle_post") {
    const [row] = await db
      .select({ id: circlePostsTable.id })
      .from(circlePostsTable)
      .where(and(eq(circlePostsTable.id, entityId), eq(circlePostsTable.circleId, circleId)))
      .limit(1);
    return !!row;
  }
  if (entityType === "comment") {
    const [row] = await db
      .select({ id: commentsTable.id })
      .from(commentsTable)
      .where(and(eq(commentsTable.id, entityId), eq(commentsTable.circleId, circleId)))
      .limit(1);
    return !!row;
  }
  if (entityType === "gratitude_note") {
    const [row] = await db
      .select({ id: gratitudeNotesTable.id })
      .from(gratitudeNotesTable)
      .where(and(eq(gratitudeNotesTable.id, entityId), eq(gratitudeNotesTable.circleId, circleId)))
      .limit(1);
    return !!row;
  }
  return false;
}

const router = Router();
const storage = new ObjectStorageService();

const ENTITY_TYPES = [
  "support_request",
  "service_post",
  "repayment",
  "circle_post",
  "comment",
  "gratitude_note",
] as const;

const entityTypeParam = z.object({
  circleId: z.coerce.number().int().positive(),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.coerce.number().int().positive(),
});

const attachmentIdParam = z.object({
  circleId: z.coerce.number().int().positive(),
  attachmentId: z.coerce.number().int().positive(),
});

const createAttachmentSchema = z.object({
  kind: z.enum(["photo", "voice", "video"]).default("photo"),
  fileName: z.string().min(1).max(500),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024).optional(),
  mimeType: z.string().min(1).max(200).optional(),
  durationMs: z.number().int().min(0).max(300_000).optional(),
  width: z.number().int().min(0).optional(),
  height: z.number().int().min(0).optional(),
  storageKey: z.string().min(1).max(2000),
});

function attachmentToApi(a: typeof attachmentsTable.$inferSelect) {
  return {
    id: a.id,
    circleId: a.circleId,
    uploadedByUserId: a.uploadedByUserId,
    targetEntityType: a.targetEntityType,
    targetEntityId: a.targetEntityId,
    kind: a.kind ?? "photo",
    fileName: a.fileName,
    fileSize: a.fileSize,
    mimeType: a.mimeType,
    durationMs: a.durationMs ?? null,
    width: a.width ?? null,
    height: a.height ?? null,
    storageKey: a.storageKey,
    downloadUrl: `/api/storage${a.storageKey}`,
    status: a.status,
    createdAt: a.createdAt,
  };
}

router.get(
  "/circles/:circleId/attachments/:entityType/:entityId",
  requireAuth,
  validateParams(entityTypeParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { circleId, entityType, entityId } = req.params as unknown as {
      circleId: number;
      entityType: string;
      entityId: number;
    };

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const rows = await db
      .select()
      .from(attachmentsTable)
      .where(
        and(
          eq(attachmentsTable.circleId, circleId),
          eq(attachmentsTable.targetEntityType, entityType),
          eq(attachmentsTable.targetEntityId, entityId),
          eq(attachmentsTable.status, "active"),
          isNull(attachmentsTable.deletedAt),
        ),
      );

    res.json(rows.map(attachmentToApi));
  },
);

router.post(
  "/circles/:circleId/attachments/:entityType/:entityId",
  requireAuth,
  validateParams(entityTypeParam),
  validateBody(createAttachmentSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const clerkId = req.dbUser!.clerkId;
    const { circleId, entityType, entityId } = req.params as unknown as {
      circleId: number;
      entityType: string;
      entityId: number;
    };
    const { kind, fileName, fileSize, mimeType, durationMs, width, height, storageKey } = req.body as {
      kind: "photo" | "voice" | "video";
      fileName: string;
      fileSize?: number;
      mimeType?: string;
      durationMs?: number;
      width?: number;
      height?: number;
      storageKey: string;
    };

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const entityExists = await assertAttachmentEntityInCircle(circleId, entityType, entityId);
    if (!entityExists) {
      res.status(404).json({ error: `${entityType.replace("_", " ")} not found in this circle` });
      return;
    }

    // Product rules for which media kinds are valid on which entity types:
    //   - voice: requests, comments, gratitude notes
    //   - video: wall posts only
    //   - photo: anywhere it's allowed
    // Enforce server-side so a client can't post a video on a comment, etc.
    const VOICE_ENTITY_TYPES = new Set([
      "support_request",
      "comment",
      "gratitude_note",
    ]);
    const VIDEO_ENTITY_TYPES = new Set(["circle_post"]);
    if (kind === "voice" && !VOICE_ENTITY_TYPES.has(entityType)) {
      res.status(400).json({
        error: "Voice notes can only be attached to requests, comments, or gratitude notes.",
      });
      return;
    }
    if (kind === "video" && !VIDEO_ENTITY_TYPES.has(entityType)) {
      res.status(400).json({ error: "Video clips can only be attached to wall posts." });
      return;
    }

    // Plus gating + per-kind sanity caps. Voice/video can only be *created*
    // by Plus members. Playback is open to any circle member.
    let userIsPlus = false;
    if (kind === "voice" || kind === "video") {
      userIsPlus = await isPlus(clerkId);
      if (!userIsPlus) {
        res.status(402).json({
          error: "plus_required",
          reason: kind === "voice" ? "voice_note" : "video_clip",
          message:
            kind === "voice"
              ? "MyZolve Connect Plus is required to record voice notes."
              : "MyZolve Connect Plus is required to share video clips.",
        });
        return;
      }
      // Require durationMs for voice/video so clients can't omit it to bypass
      // the duration ceiling. The recorder always knows the duration.
      if (typeof durationMs !== "number" || durationMs <= 0) {
        res.status(400).json({
          error:
            kind === "voice"
              ? "Voice notes must include a duration."
              : "Video clips must include a duration.",
        });
        return;
      }
      const maxDur = kind === "voice" ? MAX_VOICE_DURATION_MS : MAX_VIDEO_DURATION_MS;
      if (durationMs > maxDur) {
        res.status(400).json({
          error:
            kind === "voice"
              ? "Voice notes can be up to 2 minutes long."
              : "Video clips can be up to 30 seconds long.",
        });
        return;
      }
    } else {
      // Photos: enforce the per-entity cap. Plus members get a roomier cap.
      userIsPlus = await isPlus(clerkId);
      const cap = userIsPlus ? PLUS_PHOTO_CAP : FREE_PHOTO_CAP;
      const [{ existing } = { existing: 0 }] = await db
        .select({ existing: count() })
        .from(attachmentsTable)
        .where(
          and(
            eq(attachmentsTable.circleId, circleId),
            eq(attachmentsTable.targetEntityType, entityType),
            eq(attachmentsTable.targetEntityId, entityId),
            eq(attachmentsTable.kind, "photo"),
            eq(attachmentsTable.status, "active"),
            isNull(attachmentsTable.deletedAt),
          ),
        );
      // Wall posts also have a legacy single-photo column on circle_posts.
      // It MUST count toward the per-post photo cap or callers can sneak in
      // an extra photo by parking it in imageObjectPath.
      let legacyPhotos = 0;
      if (entityType === "circle_post") {
        const [post] = await db
          .select({ imageObjectPath: circlePostsTable.imageObjectPath })
          .from(circlePostsTable)
          .where(eq(circlePostsTable.id, entityId))
          .limit(1);
        if (post?.imageObjectPath) legacyPhotos = 1;
      }
      if (Number(existing) + legacyPhotos >= cap) {
        if (userIsPlus) {
          res.status(400).json({
            error: `You can attach up to ${PLUS_PHOTO_CAP} photos here.`,
          });
        } else {
          res.status(402).json({
            error: "plus_required",
            reason: "photo_cap",
            message: `Free accounts can attach up to ${FREE_PHOTO_CAP} photos. Upgrade to MyZolve Connect Plus for ${PLUS_PHOTO_CAP}.`,
          });
        }
        return;
      }
    }

    const normalizedKey = storage.normalizeObjectEntityPath(storageKey);

    // Token validation:
    //   - voice/video MUST come through /storage/circle-media/request-url so
    //     they carry a media policy with caps + allowed mime prefix.
    //   - photos may also come through the legacy /storage/uploads/request-url
    //     (older web clients) — for legacy tokens we synthesize an equivalent
    //     "photo" policy so downstream defense-in-depth checks still apply.
    let policy: MediaPolicy | null = validateAndConsumeMediaUpload(
      normalizedKey,
      userId,
      circleId,
      kind,
    );
    if (!policy && kind === "photo") {
      const legacyOk = validateAndConsumePendingUpload(normalizedKey, userId, circleId);
      if (legacyOk) {
        // We resolved userIsPlus above for the cap branch; if not (defensive),
        // resolve it now to apply the right photo file-size cap.
        if (!userIsPlus) {
          userIsPlus = await isPlus(clerkId);
        }
        policy = {
          kind: "photo",
          maxBytes: userIsPlus ? LEGACY_PHOTO_PLUS_BYTES : LEGACY_PHOTO_FREE_BYTES,
          allowedMimePrefix: "image/",
        };
      }
    }
    if (!policy) {
      res
        .status(403)
        .json({ error: "Invalid or expired upload token. Please re-upload the file." });
      return;
    }

    // Defense in depth: the presigned PUT can't enforce size/content-type by
    // itself, so re-check the *actual* uploaded object against the resolved
    // policy (per-file cap; image/audio/video top-level type).
    try {
      const objectFile = await storage.getObjectEntityFile(normalizedKey);
      const [meta] = await objectFile.getMetadata();
      const actualBytes =
        typeof meta.size === "string" ? Number(meta.size) : (meta.size ?? 0);
      const actualType =
        typeof meta.contentType === "string" ? meta.contentType : "";
      if (actualBytes > policy.maxBytes) {
        const mb = Math.round(policy.maxBytes / (1024 * 1024));
        await objectFile.delete().catch(() => undefined);
        res.status(400).json({ error: `File must be under ${mb} MB` });
        return;
      }
      if (actualType && !actualType.startsWith(policy.allowedMimePrefix)) {
        await objectFile.delete().catch(() => undefined);
        res.status(400).json({
          error: `Uploaded file type does not match the requested ${kind} attachment.`,
        });
        return;
      }
    } catch {
      res
        .status(400)
        .json({ error: "Uploaded file could not be verified. Please try again." });
      return;
    }

    const [attachment] = await db
      .insert(attachmentsTable)
      .values({
        circleId,
        uploadedByUserId: userId,
        targetEntityType: entityType,
        targetEntityId: entityId,
        kind,
        fileName,
        fileSize: fileSize ?? null,
        mimeType: mimeType ?? null,
        durationMs: durationMs ?? null,
        width: width ?? null,
        height: height ?? null,
        storageKey: normalizedKey,
        status: "active",
      })
      .returning();

    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: "attachment_uploaded",
      targetEntityType: entityType,
      targetEntityId: entityId,
      metadata: { kind, fileName, fileSize, mimeType, durationMs },
    });

    res.status(201).json(attachmentToApi(attachment));
  },
);

router.delete(
  "/circles/:circleId/attachments/:attachmentId",
  requireAuth,
  validateParams(attachmentIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const attachmentId = parseInt(String(req.params.attachmentId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const existing = await db
      .select()
      .from(attachmentsTable)
      .where(
        and(
          eq(attachmentsTable.id, attachmentId),
          eq(attachmentsTable.circleId, circleId),
          eq(attachmentsTable.status, "active"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!existing) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const isAdminOrOwner = ["owner", "admin"].includes(member.role);
    if (existing.uploadedByUserId !== userId && !isAdminOrOwner) {
      res.status(403).json({ error: "Only the uploader or an admin can delete this attachment" });
      return;
    }

    await db
      .update(attachmentsTable)
      .set({ status: "deleted", deletedAt: new Date() })
      .where(eq(attachmentsTable.id, attachmentId));

    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: "attachment_deleted",
      targetEntityType: existing.targetEntityType,
      targetEntityId: existing.targetEntityId,
      metadata: { fileName: existing.fileName, attachmentId },
    });

    res.status(204).send();
  },
);

export default router;
