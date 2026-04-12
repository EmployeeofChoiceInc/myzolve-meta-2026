import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, circleIdParam, validateQuery, paginationQuery } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  disputesTable,
  usersTable,
  supportContributionsTable,
  repaymentsTable,
  supportRequestsTable,
  circleMembersTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { assertCircleMember, createAuditLog, createNotification, getUserName } from "../lib/helpers";

const router = Router();

const disputeIdParam = z.object({
  disputeId: z.coerce.number().int().positive(),
});

const createDisputeSchema = z.object({
  targetEntityType: z.enum(["contribution", "repayment"]),
  targetEntityId: z.number().int().positive(),
  reason: z.string().min(1).max(2000),
});

const resolveDisputeSchema = z.object({
  resolution: z.enum(["resolved", "dismissed"]),
  resolutionNote: z.string().min(1).max(2000),
});

function disputeToApi(dispute: typeof disputesTable.$inferSelect, raiserName: string, resolverName?: string) {
  return {
    id: dispute.id,
    circleId: dispute.circleId,
    raisedByUserId: dispute.raisedByUserId,
    raisedByName: raiserName,
    targetEntityType: dispute.targetEntityType,
    targetEntityId: dispute.targetEntityId,
    reason: dispute.reason,
    status: dispute.status,
    resolvedByUserId: dispute.resolvedByUserId,
    resolvedByName: resolverName ?? null,
    resolutionNote: dispute.resolutionNote,
    resolvedAt: dispute.resolvedAt,
    createdAt: dispute.createdAt,
  };
}

async function verifyEntityBelongsToCircle(
  targetEntityType: string,
  targetEntityId: number,
  circleId: number,
): Promise<boolean> {
  if (targetEntityType === "contribution") {
    const contrib = await db
      .select({ id: supportContributionsTable.id })
      .from(supportContributionsTable)
      .where(
        and(
          eq(supportContributionsTable.id, targetEntityId),
          eq(supportContributionsTable.circleId, circleId),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);
    return contrib !== null;
  }
  if (targetEntityType === "repayment") {
    const repayment = await db
      .select({ id: repaymentsTable.id })
      .from(repaymentsTable)
      .innerJoin(supportRequestsTable, eq(repaymentsTable.requestId, supportRequestsTable.id))
      .where(
        and(
          eq(repaymentsTable.id, targetEntityId),
          eq(supportRequestsTable.circleId, circleId),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);
    return repayment !== null;
  }
  return false;
}

async function freezeEntity(targetEntityType: string, targetEntityId: number, circleId: number) {
  if (targetEntityType === "contribution") {
    await db
      .update(supportContributionsTable)
      .set({ status: "disputed" })
      .where(
        and(
          eq(supportContributionsTable.id, targetEntityId),
          eq(supportContributionsTable.circleId, circleId),
          eq(supportContributionsTable.status, "pledged"),
        ),
      );
  } else if (targetEntityType === "repayment") {
    const repayment = await db
      .select({ id: repaymentsTable.id, status: repaymentsTable.status })
      .from(repaymentsTable)
      .innerJoin(supportRequestsTable, eq(repaymentsTable.requestId, supportRequestsTable.id))
      .where(
        and(
          eq(repaymentsTable.id, targetEntityId),
          eq(supportRequestsTable.circleId, circleId),
          eq(repaymentsTable.status, "pending_confirmation"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);
    if (repayment) {
      await db
        .update(repaymentsTable)
        .set({ status: "disputed" })
        .where(eq(repaymentsTable.id, targetEntityId));
    }
  }
}

async function unfreezeEntity(targetEntityType: string, targetEntityId: number, circleId: number) {
  if (targetEntityType === "contribution") {
    await db
      .update(supportContributionsTable)
      .set({ status: "pledged" })
      .where(
        and(
          eq(supportContributionsTable.id, targetEntityId),
          eq(supportContributionsTable.circleId, circleId),
          eq(supportContributionsTable.status, "disputed"),
        ),
      );
  } else if (targetEntityType === "repayment") {
    const request = await db
      .select({ circleId: supportRequestsTable.circleId })
      .from(repaymentsTable)
      .innerJoin(supportRequestsTable, eq(repaymentsTable.requestId, supportRequestsTable.id))
      .where(
        and(
          eq(repaymentsTable.id, targetEntityId),
          eq(supportRequestsTable.circleId, circleId),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);
    if (request) {
      await db
        .update(repaymentsTable)
        .set({ status: "pending_confirmation" })
        .where(
          and(
            eq(repaymentsTable.id, targetEntityId),
            eq(repaymentsTable.status, "disputed"),
          ),
        );
    }
  }
}

router.get(
  "/circles/:circleId/disputes",
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

    const isAdminOrOwner = ["owner", "admin"].includes(member.role);

    const rows = await db
      .select({ dispute: disputesTable, raiser: usersTable })
      .from(disputesTable)
      .leftJoin(usersTable, eq(disputesTable.raisedByUserId, usersTable.id))
      .where(eq(disputesTable.circleId, circleId))
      .orderBy(desc(disputesTable.createdAt))
      .limit(limit)
      .offset(offset);

    const visible = isAdminOrOwner
      ? rows
      : rows.filter((r) => r.dispute.raisedByUserId === userId);

    res.json(visible.map((r) => disputeToApi(r.dispute, r.raiser?.displayName ?? "Someone")));
  },
);

router.post(
  "/circles/:circleId/disputes",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(createDisputeSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const { targetEntityType, targetEntityId, reason } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const entityValid = await verifyEntityBelongsToCircle(targetEntityType, targetEntityId, circleId);
    if (!entityValid) {
      res.status(404).json({ error: "Target entity not found in this circle" });
      return;
    }

    await freezeEntity(targetEntityType, targetEntityId, circleId);

    const [dispute] = await db
      .insert(disputesTable)
      .values({
        circleId,
        raisedByUserId: userId,
        targetEntityType,
        targetEntityId,
        reason,
        status: "open",
      })
      .returning();

    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: "dispute_opened",
      targetEntityType,
      targetEntityId,
      metadata: { reason: reason.slice(0, 200) },
    });

    const circleMembers = await db
      .select({ userId: circleMembersTable.userId })
      .from(circleMembersTable)
      .where(and(eq(circleMembersTable.circleId, circleId), eq(circleMembersTable.status, "active")))
      .then((rows) => rows.filter((r) => r.userId !== null && r.userId !== userId)) as { userId: number }[];

    const raisedByName = req.dbUser!.displayName;
    for (const cm of circleMembers) {
      await createNotification({
        userId: cm.userId,
        circleId,
        notificationType: "dispute_opened",
        title: "A dispute has been raised",
        body: `${raisedByName} raised a dispute: "${reason.slice(0, 100)}${reason.length > 100 ? "…" : ""}"`,
        targetEntityType: "dispute",
        targetEntityId: dispute.id,
      });
    }

    res.status(201).json(disputeToApi(dispute, raisedByName));
  },
);

router.post(
  "/circles/:circleId/disputes/:disputeId/resolve",
  requireAuth,
  validateParams(circleIdParam.merge(disputeIdParam)),
  validateBody(resolveDisputeSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const disputeId = parseInt(String(req.params.disputeId));
    const { resolution, resolutionNote } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const isAdminOrOwner = ["owner", "admin"].includes(member.role);
    if (!isAdminOrOwner) {
      res.status(403).json({ error: "Only admins can resolve disputes" });
      return;
    }

    const dispute = await db
      .select()
      .from(disputesTable)
      .where(and(eq(disputesTable.id, disputeId), eq(disputesTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0]);

    if (!dispute) {
      res.status(404).json({ error: "Dispute not found" });
      return;
    }

    if (dispute.status !== "open") {
      res.status(409).json({ error: "Dispute is already resolved" });
      return;
    }

    const [updated] = await db
      .update(disputesTable)
      .set({
        status: resolution,
        resolvedByUserId: userId,
        resolutionNote,
        resolvedAt: new Date(),
      })
      .where(eq(disputesTable.id, disputeId))
      .returning();

    await unfreezeEntity(dispute.targetEntityType, dispute.targetEntityId, circleId);

    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: `dispute_${resolution}`,
      targetEntityType: "dispute",
      targetEntityId: disputeId,
      metadata: { resolutionNote: resolutionNote.slice(0, 200) },
    });

    await createNotification({
      userId: dispute.raisedByUserId,
      circleId,
      notificationType: "dispute_resolved",
      title: `Your dispute has been ${resolution}`,
      body: resolutionNote,
      targetEntityType: "dispute",
      targetEntityId: disputeId,
    });

    const resolverName = await getUserName(userId);
    const raiserName = await getUserName(dispute.raisedByUserId);
    res.json(disputeToApi(updated, raiserName, resolverName));
  },
);

export default router;
