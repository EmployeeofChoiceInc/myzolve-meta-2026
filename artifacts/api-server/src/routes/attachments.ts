import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, circleIdParam } from "../middlewares/validate";
import { db } from "@workspace/db";
import { attachmentsTable, supportRequestsTable, servicePostsTable, repaymentsTable } from "@workspace/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { assertCircleMember, createAuditLog } from "../lib/helpers";
import { ObjectStorageService } from "../lib/objectStorage";
import { validateAndConsumePendingUpload } from "../lib/uploadTokens";

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
  return false;
}

const router = Router();
const storage = new ObjectStorageService();

const entityTypeParam = z.object({
  circleId: z.coerce.number().int().positive(),
  entityType: z.enum(["support_request", "service_post", "repayment"]),
  entityId: z.coerce.number().int().positive(),
});

const attachmentIdParam = z.object({
  circleId: z.coerce.number().int().positive(),
  attachmentId: z.coerce.number().int().positive(),
});

const createAttachmentSchema = z.object({
  fileName: z.string().min(1).max(500),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024),
  mimeType: z.string().min(1).max(200),
  storageKey: z.string().min(1).max(2000),
});

function attachmentToApi(a: typeof attachmentsTable.$inferSelect) {
  return {
    id: a.id,
    circleId: a.circleId,
    uploadedByUserId: a.uploadedByUserId,
    targetEntityType: a.targetEntityType,
    targetEntityId: a.targetEntityId,
    fileName: a.fileName,
    fileSize: a.fileSize,
    mimeType: a.mimeType,
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
    const { circleId, entityType, entityId } = req.params as unknown as {
      circleId: number;
      entityType: string;
      entityId: number;
    };
    const { fileName, fileSize, mimeType, storageKey } = req.body;

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

    const normalizedKey = storage.normalizeObjectEntityPath(storageKey);

    const isOwner = validateAndConsumePendingUpload(normalizedKey, userId, circleId);
    if (!isOwner) {
      res.status(403).json({ error: "Invalid or expired upload token. Please re-upload the file." });
      return;
    }

    const [attachment] = await db
      .insert(attachmentsTable)
      .values({
        circleId,
        uploadedByUserId: userId,
        targetEntityType: entityType,
        targetEntityId: entityId,
        fileName,
        fileSize: fileSize ?? null,
        mimeType: mimeType ?? null,
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
      metadata: { fileName, fileSize, mimeType },
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
