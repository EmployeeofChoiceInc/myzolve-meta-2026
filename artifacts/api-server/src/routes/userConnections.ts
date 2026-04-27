import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  userConnectionsTable,
  userBlocksTable,
  usersTable,
} from "@workspace/db";
import { eq, and, or, inArray } from "drizzle-orm";
import { createNotification } from "../lib/helpers";

const router = Router();

const connectionIdParam = z.object({
  connectionId: z.coerce.number().int().positive(),
});

const requestSchema = z.object({
  receiverUserId: z.number().int().positive(),
  message: z.string().max(280).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(["pending", "accepted", "declined", "all"]).optional(),
  direction: z.enum(["incoming", "outgoing", "both"]).optional(),
});

type ConnectionStatus = "pending" | "accepted" | "declined";
type ConnectionDirection = "incoming" | "outgoing";

type EnrichedConnection = {
  id: number;
  status: ConnectionStatus;
  direction: ConnectionDirection;
  message: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  otherUser: {
    id: number;
    displayName: string;
    firstName: string | null;
    avatarObjectPath: string | null;
    pronouns: string | null;
  };
};

async function enrichConnections(
  rows: (typeof userConnectionsTable.$inferSelect)[],
  meId: number,
): Promise<EnrichedConnection[]> {
  if (rows.length === 0) return [];
  const otherIds = Array.from(
    new Set(rows.map((r) => (r.initiatorUserId === meId ? r.receiverUserId : r.initiatorUserId))),
  );
  const users = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      firstName: usersTable.firstName,
      avatarObjectPath: usersTable.avatarObjectPath,
      pronouns: usersTable.pronouns,
    })
    .from(usersTable)
    .where(inArray(usersTable.id, otherIds));
  const userMap = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => {
    const otherId = r.initiatorUserId === meId ? r.receiverUserId : r.initiatorUserId;
    const u = userMap.get(otherId);
    return {
      id: r.id,
      status: r.status as ConnectionStatus,
      direction: r.initiatorUserId === meId ? ("outgoing" as ConnectionDirection) : ("incoming" as ConnectionDirection),
      message: r.message ?? null,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt ?? null,
      otherUser: {
        id: otherId,
        displayName: u?.displayName ?? "Member",
        firstName: u?.firstName ?? null,
        avatarObjectPath: u?.avatarObjectPath ?? null,
        pronouns: u?.pronouns ?? null,
      },
    };
  });
}

/** Returns true if either user has blocked the other. */
async function isBlockedEitherWay(a: number, b: number): Promise<boolean> {
  const row = await db
    .select({ id: userBlocksTable.id })
    .from(userBlocksTable)
    .where(
      or(
        and(eq(userBlocksTable.blockerUserId, a), eq(userBlocksTable.blockedUserId, b)),
        and(eq(userBlocksTable.blockerUserId, b), eq(userBlocksTable.blockedUserId, a)),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  return !!row;
}

/**
 * GET /user-connections?status=&direction=
 * Lists my user-to-user connections as a flat array, optionally filtered by
 * status and/or direction. Default: status=accepted, direction=both.
 */
router.get("/user-connections", requireAuth, async (req, res) => {
  const meId = req.dbUser!.id;
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const status = parsed.data.status ?? "accepted";
  const direction = parsed.data.direction ?? "both";

  const rows = await db
    .select()
    .from(userConnectionsTable)
    .where(
      or(
        eq(userConnectionsTable.initiatorUserId, meId),
        eq(userConnectionsTable.receiverUserId, meId),
      ),
    );
  let enriched = await enrichConnections(rows, meId);
  if (status !== "all") {
    enriched = enriched.filter((c) => c.status === status);
  }
  if (direction !== "both") {
    enriched = enriched.filter((c) => c.direction === direction);
  }
  enriched.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  res.json(enriched);
});

/**
 * POST /user-connections
 * Send a connection request (or re-open a previously-declined one).
 * Refuses with 403 if either party has blocked the other.
 */
// Anti-abuse: after a decline, the same initiator cannot re-send to the
// same receiver for this many hours. Receiver may still re-open the
// conversation by sending their own request.
const RESEND_COOLDOWN_HOURS = 24;

router.post("/user-connections", requireAuth, validateBody(requestSchema), async (req, res) => {
  const meId = req.dbUser!.id;
  const { receiverUserId: targetId, message } = req.body as {
    receiverUserId: number;
    message?: string;
  };

  if (targetId === meId) {
    res.status(400).json({ error: "You cannot connect with yourself" });
    return;
  }

  const target = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName })
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (await isBlockedEitherWay(meId, targetId)) {
    res.status(403).json({ error: "user_blocked" });
    return;
  }

  // Look up an existing row in either direction. If accepted, return as-is
  // (idempotent). If pending, return as-is. If declined, reset to pending
  // with the latest message.
  const existing = await db
    .select()
    .from(userConnectionsTable)
    .where(
      or(
        and(
          eq(userConnectionsTable.initiatorUserId, meId),
          eq(userConnectionsTable.receiverUserId, targetId),
        ),
        and(
          eq(userConnectionsTable.initiatorUserId, targetId),
          eq(userConnectionsTable.receiverUserId, meId),
        ),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  let row;
  let isNew = false;
  if (existing) {
    if (existing.status === "accepted") {
      const [enriched] = await enrichConnections([existing], meId);
      res.status(200).json(enriched);
      return;
    }
    if (existing.status === "pending") {
      // If the existing pending request is FROM the target TO me, treat
      // this as an accept on my part — that's the friendliest UX.
      if (existing.receiverUserId === meId) {
        const [updated] = await db
          .update(userConnectionsTable)
          .set({ status: "accepted", respondedAt: new Date() })
          .where(eq(userConnectionsTable.id, existing.id))
          .returning();
        const myName = req.dbUser!.displayName;
        await createNotification({
          userId: existing.initiatorUserId,
          notificationType: "connection_request_accepted",
          title: `${myName} accepted your connection request`,
          body: "You can now message each other.",
          targetEntityType: "user_connection",
          targetEntityId: updated.id,
        });
        const [enriched] = await enrichConnections([updated], meId);
        res.status(200).json(enriched);
        return;
      }
      const [enriched] = await enrichConnections([existing], meId);
      res.status(200).json(enriched);
      return;
    }
    // declined → enforce cooldown when the same initiator tries again.
    // The other party can always re-open by sending their own request.
    if (
      existing.status === "declined" &&
      existing.initiatorUserId === meId &&
      existing.respondedAt
    ) {
      const elapsedMs = Date.now() - existing.respondedAt.getTime();
      const cooldownMs = RESEND_COOLDOWN_HOURS * 60 * 60 * 1000;
      if (elapsedMs < cooldownMs) {
        res.status(429).json({
          error: "resend_cooldown",
          retryAfterHours: Math.ceil((cooldownMs - elapsedMs) / (60 * 60 * 1000)),
        });
        return;
      }
    }
    // declined → reset to pending, keep me as initiator (flip direction
    // if the previous initiator was the other user, so the "incoming"
    // request is correctly attributed).
    const [updated] = await db
      .update(userConnectionsTable)
      .set({
        initiatorUserId: meId,
        receiverUserId: targetId,
        status: "pending",
        message: message ?? null,
        respondedAt: null,
      })
      .where(eq(userConnectionsTable.id, existing.id))
      .returning();
    row = updated;
  } else {
    const [inserted] = await db
      .insert(userConnectionsTable)
      .values({
        initiatorUserId: meId,
        receiverUserId: targetId,
        status: "pending",
        message: message ?? null,
      })
      .returning();
    row = inserted;
    isNew = true;
  }

  const myName = req.dbUser!.displayName;
  await createNotification({
    userId: targetId,
    notificationType: "connection_request_received",
    title: `${myName} wants to connect`,
    body: message ? `"${message.slice(0, 120)}"` : "Tap to view their request.",
    targetEntityType: "user_connection",
    targetEntityId: row.id,
  });

  const [enriched] = await enrichConnections([row], meId);
  res.status(isNew ? 201 : 200).json(enriched);
});

/**
 * POST /user-connections/:connectionId/accept
 * Receiver accepts a pending request → becomes "accepted".
 */
router.post(
  "/user-connections/:connectionId/accept",
  requireAuth,
  validateParams(connectionIdParam),
  async (req, res) => {
    const meId = req.dbUser!.id;
    const id = parseInt(String(req.params.connectionId));
    const row = await db
      .select()
      .from(userConnectionsTable)
      .where(eq(userConnectionsTable.id, id))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!row) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    if (row.receiverUserId !== meId) {
      res.status(403).json({ error: "Only the recipient can accept this request" });
      return;
    }
    if (row.status !== "pending") {
      res.status(400).json({ error: `Request is already ${row.status}` });
      return;
    }
    if (await isBlockedEitherWay(meId, row.initiatorUserId)) {
      res.status(403).json({ error: "user_blocked" });
      return;
    }
    const [updated] = await db
      .update(userConnectionsTable)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(userConnectionsTable.id, id))
      .returning();

    const myName = req.dbUser!.displayName;
    await createNotification({
      userId: row.initiatorUserId,
      notificationType: "connection_request_accepted",
      title: `${myName} accepted your connection request`,
      body: "You can now message each other.",
      targetEntityType: "user_connection",
      targetEntityId: updated.id,
    });

    const [enriched] = await enrichConnections([updated], meId);
    res.json(enriched);
  },
);

/**
 * POST /user-connections/:connectionId/decline
 * Receiver declines a pending request → becomes "declined".
 * The initiator is NOT notified (least-bad-UX for soft refusals).
 */
router.post(
  "/user-connections/:connectionId/decline",
  requireAuth,
  validateParams(connectionIdParam),
  async (req, res) => {
    const meId = req.dbUser!.id;
    const id = parseInt(String(req.params.connectionId));
    const row = await db
      .select()
      .from(userConnectionsTable)
      .where(eq(userConnectionsTable.id, id))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!row) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    if (row.receiverUserId !== meId) {
      res.status(403).json({ error: "Only the recipient can decline this request" });
      return;
    }
    if (row.status !== "pending") {
      res.status(400).json({ error: `Request is already ${row.status}` });
      return;
    }
    const [updated] = await db
      .update(userConnectionsTable)
      .set({ status: "declined", respondedAt: new Date() })
      .where(eq(userConnectionsTable.id, id))
      .returning();
    const [enriched] = await enrichConnections([updated], meId);
    res.json(enriched);
  },
);

/**
 * DELETE /user-connections/:connectionId
 * Either party disconnects, or the initiator cancels a pending request.
 * Hard-deletes the row so a future "Connect" creates a fresh one.
 */
router.delete(
  "/user-connections/:connectionId",
  requireAuth,
  validateParams(connectionIdParam),
  async (req, res) => {
    const meId = req.dbUser!.id;
    const id = parseInt(String(req.params.connectionId));
    const row = await db
      .select()
      .from(userConnectionsTable)
      .where(eq(userConnectionsTable.id, id))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!row) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    if (row.initiatorUserId !== meId && row.receiverUserId !== meId) {
      res.status(403).json({ error: "Not your connection" });
      return;
    }
    // Anti-abuse: don't let the original initiator delete a declined row to
    // dodge the resend cooldown. The receiver may always delete it (which
    // also clears the cooldown — they're explicitly opting back in).
    if (row.status === "declined" && row.initiatorUserId === meId) {
      res
        .status(403)
        .json({ error: "cannot_delete_declined_as_initiator" });
      return;
    }
    await db.delete(userConnectionsTable).where(eq(userConnectionsTable.id, id));
    res.status(204).end();
  },
);

// ── Blocks ─────────────────────────────────────────────────────────────────
const userIdParam = z.object({
  userId: z.coerce.number().int().positive(),
});

type BlockResponse = {
  id: number;
  blockedUser: {
    id: number;
    displayName: string;
    avatarObjectPath: string | null;
  };
  createdAt: Date;
};

async function buildBlockResponse(
  blockId: number,
  blockedUserId: number,
  createdAt: Date,
): Promise<BlockResponse> {
  const [u] = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      avatarObjectPath: usersTable.avatarObjectPath,
    })
    .from(usersTable)
    .where(eq(usersTable.id, blockedUserId))
    .limit(1);
  return {
    id: blockId,
    blockedUser: {
      id: blockedUserId,
      displayName: u?.displayName ?? "Member",
      avatarObjectPath: u?.avatarObjectPath ?? null,
    },
    createdAt,
  };
}

/**
 * GET /user-blocks
 * Returns the list of users I have blocked, with nested user info.
 */
router.get("/user-blocks", requireAuth, async (req, res) => {
  const meId = req.dbUser!.id;
  const rows = await db
    .select({
      id: userBlocksTable.id,
      blockedUserId: userBlocksTable.blockedUserId,
      createdAt: userBlocksTable.createdAt,
    })
    .from(userBlocksTable)
    .where(eq(userBlocksTable.blockerUserId, meId));
  if (rows.length === 0) {
    res.json([]);
    return;
  }
  const ids = rows.map((r) => r.blockedUserId);
  const users = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      avatarObjectPath: usersTable.avatarObjectPath,
    })
    .from(usersTable)
    .where(inArray(usersTable.id, ids));
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json(
    rows.map((r) => {
      const u = userMap.get(r.blockedUserId);
      return {
        id: r.id,
        blockedUser: {
          id: r.blockedUserId,
          displayName: u?.displayName ?? "Member",
          avatarObjectPath: u?.avatarObjectPath ?? null,
        },
        createdAt: r.createdAt,
      };
    }),
  );
});

/**
 * POST /user-blocks/:userId
 * Block a user. Side-effects: deletes any existing user-connection between
 * us in either direction so the relationship is fully severed.
 */
router.post(
  "/user-blocks/:userId",
  requireAuth,
  validateParams(userIdParam),
  async (req, res) => {
    const meId = req.dbUser!.id;
    const targetId = parseInt(String(req.params.userId));
    if (targetId === meId) {
      res.status(400).json({ error: "You cannot block yourself" });
      return;
    }
    const target = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, targetId))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // Idempotent: if a row already exists, return it.
    const existing = await db
      .select()
      .from(userBlocksTable)
      .where(
        and(
          eq(userBlocksTable.blockerUserId, meId),
          eq(userBlocksTable.blockedUserId, targetId),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);
    if (existing) {
      res.status(200).json(
        await buildBlockResponse(existing.id, targetId, existing.createdAt),
      );
      return;
    }
    const [inserted] = await db
      .insert(userBlocksTable)
      .values({ blockerUserId: meId, blockedUserId: targetId })
      .returning();
    // Sever any user-to-user connection in either direction so it doesn't
    // grant message permission.
    await db
      .delete(userConnectionsTable)
      .where(
        or(
          and(
            eq(userConnectionsTable.initiatorUserId, meId),
            eq(userConnectionsTable.receiverUserId, targetId),
          ),
          and(
            eq(userConnectionsTable.initiatorUserId, targetId),
            eq(userConnectionsTable.receiverUserId, meId),
          ),
        ),
      );
    res
      .status(201)
      .json(await buildBlockResponse(inserted.id, targetId, inserted.createdAt));
  },
);

/**
 * DELETE /user-blocks/:userId
 * Unblock a user. Doesn't restore the previous connection — they have to
 * send a fresh request.
 */
router.delete(
  "/user-blocks/:userId",
  requireAuth,
  validateParams(userIdParam),
  async (req, res) => {
    const meId = req.dbUser!.id;
    const targetId = parseInt(String(req.params.userId));
    await db
      .delete(userBlocksTable)
      .where(
        and(
          eq(userBlocksTable.blockerUserId, meId),
          eq(userBlocksTable.blockedUserId, targetId),
        ),
      );
    res.status(204).end();
  },
);

export default router;
