import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  directMessagesTable,
  circleMembersTable,
  circlesTable,
  usersTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, or, desc, asc, isNull, inArray } from "drizzle-orm";
import {
  createNotification,
  hasAcceptedUserConnection,
  isBlockedEitherWay,
} from "../lib/helpers";

const router = Router();

const userIdParam = z.object({
  userId: z.coerce.number().int().positive(),
});

const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000),
});

/**
 * Decides whether `senderId` may message `recipientId`. As of Task #95
 * the rule is:
 *
 *   1. A block in either direction always returns false.
 *   2. Otherwise, allow if they share at least one active circle.
 *   3. Otherwise, allow if they have an accepted user-to-user connection.
 *   4. Otherwise, fall back to the legacy "both are circle creators"
 *      grandfather rule (kept so onboarding owners can still reach each
 *      other through the Find People page before either has invited
 *      anyone).
 */
async function canMessage(senderId: number, recipientId: number): Promise<boolean> {
  if (await isBlockedEitherWay(senderId, recipientId)) return false;

  // Get circles where sender is an active member
  const senderCircles = await db
    .select({ circleId: circleMembersTable.circleId })
    .from(circleMembersTable)
    .where(and(eq(circleMembersTable.userId, senderId), eq(circleMembersTable.status, "active")));

  if (senderCircles.length > 0) {
    const senderCircleIds = senderCircles.map((c) => c.circleId);
    const shared = await db
      .select({ id: circleMembersTable.id })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.userId, recipientId),
          eq(circleMembersTable.status, "active"),
          inArray(circleMembersTable.circleId, senderCircleIds),
        ),
      )
      .limit(1);
    if (shared.length > 0) return true;
  }

  if (await hasAcceptedUserConnection(senderId, recipientId)) return true;

  // Both are circle creators?
  const [senderCircle, recipientCircle] = await Promise.all([
    db
      .select({ id: circlesTable.id })
      .from(circlesTable)
      .where(eq(circlesTable.ownerId, senderId))
      .limit(1),
    db
      .select({ id: circlesTable.id })
      .from(circlesTable)
      .where(eq(circlesTable.ownerId, recipientId))
      .limit(1),
  ]);

  return senderCircle.length > 0 && recipientCircle.length > 0;
}

/**
 * GET /messages
 * Inbox: one row per conversation partner, showing latest message + unread count.
 */
router.get("/messages", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;

  // All messages where I'm a participant
  const allMessages = await db
    .select({
      id: directMessagesTable.id,
      senderUserId: directMessagesTable.senderUserId,
      recipientUserId: directMessagesTable.recipientUserId,
      body: directMessagesTable.body,
      readAt: directMessagesTable.readAt,
      createdAt: directMessagesTable.createdAt,
    })
    .from(directMessagesTable)
    .where(
      or(
        eq(directMessagesTable.senderUserId, userId),
        eq(directMessagesTable.recipientUserId, userId),
      ),
    )
    .orderBy(desc(directMessagesTable.createdAt));

  // Group into threads by partner ID
  const threadMap = new Map<number, {
    partnerId: number;
    lastMessage: typeof allMessages[0];
    unreadCount: number;
  }>();

  for (const msg of allMessages) {
    const partnerId = msg.senderUserId === userId ? msg.recipientUserId : msg.senderUserId;
    if (!threadMap.has(partnerId)) {
      threadMap.set(partnerId, { partnerId, lastMessage: msg, unreadCount: 0 });
    }
    // Count messages I received that are unread
    if (msg.recipientUserId === userId && !msg.readAt) {
      threadMap.get(partnerId)!.unreadCount++;
    }
  }

  if (threadMap.size === 0) {
    res.json([]);
    return;
  }

  // Fetch partner display info
  const partnerIds = Array.from(threadMap.keys());
  const partners = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, avatarObjectPath: usersTable.avatarObjectPath })
    .from(usersTable)
    .where(inArray(usersTable.id, partnerIds));

  const partnerMap = new Map(partners.map((p) => [p.id, p]));

  const threads = Array.from(threadMap.values())
    .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime())
    .map((t) => {
      const partner = partnerMap.get(t.partnerId);
      return {
        partnerId: t.partnerId,
        partnerName: partner?.displayName ?? "Unknown",
        partnerAvatarObjectPath: partner?.avatarObjectPath ?? null,
        lastMessage: {
          id: t.lastMessage.id,
          body: t.lastMessage.body,
          senderUserId: t.lastMessage.senderUserId,
          createdAt: t.lastMessage.createdAt,
        },
        unreadCount: t.unreadCount,
      };
    });

  res.json(threads);
});

/**
 * GET /messages/unread-count
 * Total unread messages for the current user.
 */
router.get("/messages/unread-count", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;

  const rows = await db
    .select({ id: directMessagesTable.id })
    .from(directMessagesTable)
    .where(
      and(
        eq(directMessagesTable.recipientUserId, userId),
        isNull(directMessagesTable.readAt),
      ),
    );

  res.json({ unreadCount: rows.length });
});

/**
 * GET /messages/:userId
 * Full thread between me and another user. Validates shared circle or both creators.
 */
router.get("/messages/:userId", requireAuth, validateParams(userIdParam), async (req, res) => {
  const myId = req.dbUser!.id;
  const partnerId = parseInt(String(req.params.userId));

  if (myId === partnerId) {
    res.status(400).json({ error: "Cannot message yourself" });
    return;
  }

  const partner = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, avatarObjectPath: usersTable.avatarObjectPath })
    .from(usersTable)
    .where(eq(usersTable.id, partnerId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!partner) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const allowed = await canMessage(myId, partnerId);
  if (!allowed) {
    res.status(403).json({ error: "You can only message people who share a circle with you or fellow circle creators." });
    return;
  }

  const messages = await db
    .select()
    .from(directMessagesTable)
    .where(
      or(
        and(eq(directMessagesTable.senderUserId, myId), eq(directMessagesTable.recipientUserId, partnerId)),
        and(eq(directMessagesTable.senderUserId, partnerId), eq(directMessagesTable.recipientUserId, myId)),
      ),
    )
    .orderBy(asc(directMessagesTable.createdAt));

  res.json({
    partner: {
      id: partner.id,
      displayName: partner.displayName,
      avatarObjectPath: partner.avatarObjectPath,
    },
    messages: messages.map((m) => ({
      id: m.id,
      senderUserId: m.senderUserId,
      recipientUserId: m.recipientUserId,
      body: m.body,
      readAt: m.readAt,
      createdAt: m.createdAt,
    })),
  });
});

/**
 * POST /messages/:userId
 * Send a message to another user.
 */
router.post("/messages/:userId", requireAuth, validateParams(userIdParam), validateBody(sendMessageSchema), async (req, res) => {
  const myId = req.dbUser!.id;
  const recipientId = parseInt(String(req.params.userId));
  const { body } = req.body;

  if (myId === recipientId) {
    res.status(400).json({ error: "Cannot message yourself" });
    return;
  }

  const recipient = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName })
    .from(usersTable)
    .where(eq(usersTable.id, recipientId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!recipient) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const allowed = await canMessage(myId, recipientId);
  if (!allowed) {
    res.status(403).json({ error: "You can only message people who share a circle with you or fellow circle creators." });
    return;
  }

  const [inserted] = await db
    .insert(directMessagesTable)
    .values({ senderUserId: myId, recipientUserId: recipientId, body })
    .returning();

  // Notify recipient
  const senderName = req.dbUser!.displayName;
  await createNotification({
    userId: recipientId,
    notificationType: "direct_message",
    title: `New message from ${senderName}`,
    body: body.length > 80 ? body.slice(0, 80) + "…" : body,
    targetEntityType: "direct_message",
    targetEntityId: inserted.id,
  });

  res.status(201).json({
    id: inserted.id,
    senderUserId: inserted.senderUserId,
    recipientUserId: inserted.recipientUserId,
    body: inserted.body,
    readAt: inserted.readAt,
    createdAt: inserted.createdAt,
  });
});

/**
 * POST /messages/:userId/read
 * Mark all messages from :userId to me as read, and clear their notifications.
 */
router.post("/messages/:userId/read", requireAuth, validateParams(userIdParam), async (req, res) => {
  const myId = req.dbUser!.id;
  const partnerId = parseInt(String(req.params.userId));
  const now = new Date();

  await Promise.all([
    // Mark DMs as read
    db
      .update(directMessagesTable)
      .set({ readAt: now })
      .where(
        and(
          eq(directMessagesTable.senderUserId, partnerId),
          eq(directMessagesTable.recipientUserId, myId),
          isNull(directMessagesTable.readAt),
        ),
      ),
    // Mark DM notifications from this partner as read.
    // Partner's message IDs are used to scope the notification update.
    (async () => {
      const partnerMsgIds = await db
        .select({ id: directMessagesTable.id })
        .from(directMessagesTable)
        .where(
          and(
            eq(directMessagesTable.senderUserId, partnerId),
            eq(directMessagesTable.recipientUserId, myId),
          ),
        );
      if (partnerMsgIds.length > 0) {
        await db
          .update(notificationsTable)
          .set({ isRead: true, readAt: now })
          .where(
            and(
              eq(notificationsTable.userId, myId),
              eq(notificationsTable.notificationType, "direct_message"),
              eq(notificationsTable.isRead, false),
              inArray(notificationsTable.targetEntityId, partnerMsgIds.map((m) => m.id)),
            ),
          );
      }
    })(),
  ]);

  res.json({ success: true });
});

export default router;
