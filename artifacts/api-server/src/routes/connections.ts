import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, circleIdParam, validateQuery, paginationQuery } from "../middlewares/validate";
import { db } from "@workspace/db";
import { circleConnectionsTable, circlesTable, circleMembersTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { assertCircleMember, createAuditLog } from "../lib/helpers";
import { randomBytes } from "crypto";

const router = Router();

const connectionIdParam = z.object({
  connectionId: z.coerce.number().int().positive(),
});

const createConnectionSchema = z.object({
  receiverCircleId: z.number().int().positive(),
  permissionScope: z.enum(["service_only", "referral", "support_sharing"]).optional().default("service_only"),
  message: z.string().max(500).optional(),
});

const respondConnectionSchema = z.object({
  action: z.enum(["approve", "decline"]),
});

function connectionToApi(conn: typeof circleConnectionsTable.$inferSelect) {
  return {
    id: conn.id,
    initiatorCircleId: conn.initiatorCircleId,
    receiverCircleId: conn.receiverCircleId,
    permissionScope: conn.permissionScope,
    status: conn.status,
    message: conn.message,
    token: conn.token,
    respondedAt: conn.respondedAt,
    createdAt: conn.createdAt,
  };
}

async function assertCircleOwnerOrAdmin(circleId: number, userId: number) {
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

router.get(
  "/circles/:circleId/connections",
  requireAuth,
  validateParams(circleIdParam),
  validateQuery(paginationQuery),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const rows = await db
      .select()
      .from(circleConnectionsTable)
      .where(
        or(
          eq(circleConnectionsTable.initiatorCircleId, circleId),
          eq(circleConnectionsTable.receiverCircleId, circleId),
        ),
      )
      .orderBy(desc(circleConnectionsTable.createdAt));

    res.json(rows.map(connectionToApi));
  },
);

router.post(
  "/circles/:circleId/connections",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(createConnectionSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const { receiverCircleId, permissionScope, message } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const isOwnerOrAdmin = ["owner", "admin"].includes(member.role);
    if (!isOwnerOrAdmin) {
      res.status(403).json({ error: "Only circle owners and admins can initiate connections" });
      return;
    }

    if (circleId === receiverCircleId) {
      res.status(400).json({ error: "Cannot connect a circle to itself" });
      return;
    }

    const receiverCircle = await db
      .select()
      .from(circlesTable)
      .where(eq(circlesTable.id, receiverCircleId))
      .limit(1)
      .then((r) => r[0]);

    if (!receiverCircle) {
      res.status(404).json({ error: "Target circle not found" });
      return;
    }

    const existing = await db
      .select()
      .from(circleConnectionsTable)
      .where(
        or(
          and(
            eq(circleConnectionsTable.initiatorCircleId, circleId),
            eq(circleConnectionsTable.receiverCircleId, receiverCircleId),
          ),
          and(
            eq(circleConnectionsTable.initiatorCircleId, receiverCircleId),
            eq(circleConnectionsTable.receiverCircleId, circleId),
          ),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (existing && existing.status !== "declined") {
      res.status(409).json({ error: "A connection between these circles already exists" });
      return;
    }

    const token = randomBytes(32).toString("hex");
    const [connection] = await db
      .insert(circleConnectionsTable)
      .values({
        initiatorCircleId: circleId,
        receiverCircleId,
        initiatedByUserId: userId,
        permissionScope,
        status: "pending",
        token,
        message: message ?? null,
      })
      .returning();

    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: "circle_connection_initiated",
      targetEntityType: "circle",
      targetEntityId: receiverCircleId,
      metadata: { permissionScope },
    });

    res.status(201).json(connectionToApi(connection));
  },
);

router.post(
  "/circles/:circleId/connections/:connectionId/respond",
  requireAuth,
  validateParams(circleIdParam.merge(connectionIdParam)),
  validateBody(respondConnectionSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const connectionId = parseInt(String(req.params.connectionId));
    const { action } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const isOwnerOrAdmin = ["owner", "admin"].includes(member.role);
    if (!isOwnerOrAdmin) {
      res.status(403).json({ error: "Only circle owners and admins can respond to connection requests" });
      return;
    }

    const connection = await db
      .select()
      .from(circleConnectionsTable)
      .where(
        and(
          eq(circleConnectionsTable.id, connectionId),
          eq(circleConnectionsTable.receiverCircleId, circleId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!connection) {
      res.status(404).json({ error: "Connection request not found" });
      return;
    }

    if (connection.status !== "pending") {
      res.status(409).json({ error: "Connection request is no longer pending" });
      return;
    }

    const newStatus = action === "approve" ? "approved" : "declined";
    const [updated] = await db
      .update(circleConnectionsTable)
      .set({ status: newStatus, respondedByUserId: userId, respondedAt: new Date() })
      .where(eq(circleConnectionsTable.id, connectionId))
      .returning();

    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: `circle_connection_${newStatus}`,
      targetEntityType: "circle_connection",
      targetEntityId: connectionId,
    });

    res.json(connectionToApi(updated));
  },
);

export default router;
