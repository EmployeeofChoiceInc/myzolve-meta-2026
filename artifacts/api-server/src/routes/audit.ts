import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validateParams, circleIdParam, validateQuery, paginationQuery } from "../middlewares/validate";
import { db } from "@workspace/db";
import { auditLogsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { assertCircleMember } from "../lib/helpers";

const router = Router();

router.get(
  "/circles/:circleId/audit",
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
    if (!isAdminOrOwner) {
      res.status(403).json({ error: "Only admins can view audit logs" });
      return;
    }

    const rows = await db
      .select({ log: auditLogsTable, actor: usersTable })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.actorUserId, usersTable.id))
      .where(eq(auditLogsTable.circleId, circleId))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(
      rows.map((r) => ({
        id: r.log.id,
        actorUserId: r.log.actorUserId,
        actorName: r.actor?.displayName ?? "System",
        action: r.log.action,
        targetEntityType: r.log.targetEntityType,
        targetEntityId: r.log.targetEntityId,
        metadata: JSON.parse(r.log.metadata),
        createdAt: r.log.createdAt,
      })),
    );
  },
);

export default router;
