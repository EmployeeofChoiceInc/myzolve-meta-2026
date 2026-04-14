import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, validateQuery, paginationQuery } from "../middlewares/validate";
import { db } from "@workspace/db";
import { notificationsTable, notificationPreferencesTable, directMessagesTable } from "@workspace/db";
import { eq, and, desc, count, isNull } from "drizzle-orm";

const router = Router();

const notificationIdParam = z.object({
  notificationId: z.coerce.number().int().positive(),
});

const updatePrefsSchema = z.object({
  preferences: z.array(
    z.object({
      notificationType: z.enum([
        "new_request",
        "support_received",
        "repayment_due",
        "repayment_received",
        "service_match",
        "new_comment",
        "reaction_received",
        "gratitude_received",
        "dispute_opened",
        "dispute_resolved",
        "member_joined",
        "circle_update",
      ]),
      enabled: z.boolean(),
    }),
  ),
});

router.get("/notifications", requireAuth, validateQuery(paginationQuery), async (req, res) => {
  const userId = req.dbUser!.id;
  const { limit, offset } = req.query as unknown as { limit: number; offset: number };

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ unreadCount }] = await db
    .select({ unreadCount: count() })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));

  res.json({
    notifications: rows.map((n) => ({
      id: n.id,
      circleId: n.circleId,
      notificationType: n.notificationType,
      targetEntityType: n.targetEntityType,
      targetEntityId: n.targetEntityId,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
    unreadCount,
  });
});

router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;

  const [notifRows, msgRows] = await Promise.all([
    db
      .select({ cnt: count() })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false))),
    db
      .select({ cnt: count() })
      .from(directMessagesTable)
      .where(and(eq(directMessagesTable.recipientUserId, userId), isNull(directMessagesTable.readAt))),
  ]);

  const notifCount = Number(notifRows[0]?.cnt ?? 0);
  const msgCount = Number(msgRows[0]?.cnt ?? 0);

  res.json({ unreadCount: notifCount + msgCount, unreadMessages: msgCount });
});

router.post(
  "/notifications/:notificationId/read",
  requireAuth,
  validateParams(notificationIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const notificationId = parseInt(String(req.params.notificationId));

    const notification = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.id, notificationId), eq(notificationsTable.userId, userId)))
      .limit(1)
      .then((r) => r[0]);

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    const [updated] = await db
      .update(notificationsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notificationsTable.id, notificationId))
      .returning();

    res.json({ id: updated.id, isRead: updated.isRead, readAt: updated.readAt });
  },
);

router.post("/notifications/read-all", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;

  await db
    .update(notificationsTable)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));

  res.json({ success: true });
});

router.get("/notifications/preferences", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;

  const prefs = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId));

  res.json(prefs.map((p) => ({
    notificationType: p.notificationType,
    enabled: p.enabled,
  })));
});

router.put(
  "/notifications/preferences",
  requireAuth,
  validateBody(updatePrefsSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { preferences } = req.body;

    for (const pref of preferences) {
      const existing = await db
        .select()
        .from(notificationPreferencesTable)
        .where(
          and(
            eq(notificationPreferencesTable.userId, userId),
            eq(notificationPreferencesTable.notificationType, pref.notificationType),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      if (existing) {
        await db
          .update(notificationPreferencesTable)
          .set({ enabled: pref.enabled })
          .where(eq(notificationPreferencesTable.id, existing.id));
      } else {
        await db.insert(notificationPreferencesTable).values({
          userId,
          notificationType: pref.notificationType,
          enabled: pref.enabled,
        });
      }
    }

    const updated = await db
      .select()
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.userId, userId));

    res.json(updated.map((p) => ({ notificationType: p.notificationType, enabled: p.enabled })));
  },
);

export default router;
