import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateParams, validateQuery } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  usersTable,
  circleMembersTable,
  circlesTable,
  userConnectionsTable,
} from "@workspace/db";
import { eq, and, inArray, ilike, or, ne, desc } from "drizzle-orm";
import {
  isBlockedEitherWay,
  getBlockedUserIdSet,
  hasAcceptedUserConnection,
} from "../lib/helpers";

const router = Router();

const userIdParam = z.object({
  userId: z.coerce.number().int().positive(),
});

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /users/search?q=...
 * Find people by display-name fragment (case-insensitive, substring),
 * exact email match, or exact phone match (only if the target opted into
 * `phoneDiscoverable`). Excludes the caller and anyone the caller has a
 * mutual block with.
 */
router.get(
  "/users/search",
  requireAuth,
  validateQuery(searchQuerySchema),
  async (req, res) => {
    const meId = req.dbUser!.id;
    const { q, limit } = req.query as unknown as { q: string; limit: number };

    const blocked = await getBlockedUserIdSet(meId);

    // Three-pronged search:
    //   1. Substring match on display_name (case-insensitive).
    //   2. Exact email match (case-insensitive).
    //   3. Exact phone match — ONLY when the target has opted-in via
    //      phoneDiscoverable. We cannot use a JOIN-side phone filter
    //      without leaking presence; the WHERE clause already enforces it.
    const lowerQ = q.toLowerCase();
    const rows = await db
      .select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        firstName: usersTable.firstName,
        avatarObjectPath: usersTable.avatarObjectPath,
        location: usersTable.location,
        pronouns: usersTable.pronouns,
      })
      .from(usersTable)
      .where(
        and(
          ne(usersTable.id, meId),
          or(
            ilike(usersTable.displayName, `%${q}%`),
            eq(usersTable.email, lowerQ),
            and(
              eq(usersTable.phoneDiscoverable, true),
              eq(usersTable.phone, q),
            ),
          ),
        ),
      )
      .orderBy(desc(usersTable.createdAt))
      .limit(limit);

    const filtered = rows.filter((r) => !blocked.has(r.id));

    // Fetch connection status for each result, in one round-trip.
    let connectionMap = new Map<number, { id: number; status: string; direction: "incoming" | "outgoing" }>();
    if (filtered.length > 0) {
      const ids = filtered.map((r) => r.id);
      const conns = await db
        .select()
        .from(userConnectionsTable)
        .where(
          or(
            and(
              eq(userConnectionsTable.initiatorUserId, meId),
              inArray(userConnectionsTable.receiverUserId, ids),
            ),
            and(
              eq(userConnectionsTable.receiverUserId, meId),
              inArray(userConnectionsTable.initiatorUserId, ids),
            ),
          ),
        );
      for (const c of conns) {
        const otherId = c.initiatorUserId === meId ? c.receiverUserId : c.initiatorUserId;
        connectionMap.set(otherId, {
          id: c.id,
          status: c.status,
          direction: c.initiatorUserId === meId ? "outgoing" : "incoming",
        });
      }
    }

    res.json(
      filtered.map((r) => {
        const c = connectionMap.get(r.id);
        return {
          id: r.id,
          displayName: r.displayName,
          firstName: r.firstName,
          avatarObjectPath: r.avatarObjectPath,
          location: r.location,
          pronouns: r.pronouns,
          connection: c
            ? { id: c.id, status: c.status, direction: c.direction }
            : null,
        };
      }),
    );
  },
);

router.get(
  "/users/:userId/profile",
  requireAuth,
  validateParams(userIdParam),
  async (req, res) => {
    const viewerId = req.dbUser!.id;
    const targetUserId = parseInt(String(req.params.userId));

    const targetUser = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, targetUserId))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (viewerId !== targetUserId) {
      // Block check applies to both directions: a blocked user cannot
      // see the profile of their blocker, and vice-versa we render a
      // friendly empty state.
      if (await isBlockedEitherWay(viewerId, targetUserId)) {
        res.status(403).json({ error: "user_blocked" });
        return;
      }
    }

    // Compute shared circles (still useful to surface "in common with you")
    // AND the public-on-profile circles. Profile is OPEN to anyone signed
    // in — we no longer gate by shared circle.
    const [myCircles, theirCircles] = await Promise.all([
      db
        .select({ circleId: circleMembersTable.circleId })
        .from(circleMembersTable)
        .where(
          and(
            eq(circleMembersTable.userId, viewerId),
            eq(circleMembersTable.status, "active"),
          ),
        ),
      db
        .select({
          circleId: circleMembersTable.circleId,
          showOnProfile: circleMembersTable.showOnProfile,
        })
        .from(circleMembersTable)
        .where(
          and(
            eq(circleMembersTable.userId, targetUserId),
            eq(circleMembersTable.status, "active"),
          ),
        ),
    ]);

    const myCircleIds = new Set(myCircles.map((m) => m.circleId));
    const sharedCircleIds = theirCircles
      .filter((m) => myCircleIds.has(m.circleId))
      .map((m) => m.circleId);

    // Public circles = the target's circles whose membership row is marked
    // showOnProfile, gated by their own profileShowCirclesDefault toggle.
    // When the global toggle is off, we surface NO circles at all (other
    // than the ones we share with the viewer, which are common knowledge).
    const publicCircleIds = targetUser.profileShowCirclesDefault
      ? theirCircles.filter((m) => m.showOnProfile).map((m) => m.circleId)
      : [];

    // Union (shared ∪ public) so the viewer always sees the circles they
    // already know about, plus any extras the target chose to publicize.
    const visibleCircleIds = Array.from(new Set([...sharedCircleIds, ...publicCircleIds]));

    const visibleCircles =
      visibleCircleIds.length > 0
        ? await db
            .select({ id: circlesTable.id, name: circlesTable.name })
            .from(circlesTable)
            .where(inArray(circlesTable.id, visibleCircleIds))
        : [];

    // Connection status (so the profile button can render Connect / Pending
    // / Connected / Respond without a second round-trip).
    let connection: {
      id: number;
      status: string;
      direction: "incoming" | "outgoing";
    } | null = null;
    if (viewerId !== targetUserId) {
      const c = await db
        .select()
        .from(userConnectionsTable)
        .where(
          or(
            and(
              eq(userConnectionsTable.initiatorUserId, viewerId),
              eq(userConnectionsTable.receiverUserId, targetUserId),
            ),
            and(
              eq(userConnectionsTable.initiatorUserId, targetUserId),
              eq(userConnectionsTable.receiverUserId, viewerId),
            ),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (c) {
        connection = {
          id: c.id,
          status: c.status,
          direction: c.initiatorUserId === viewerId ? "outgoing" : "incoming",
        };
      }
    }

    // Whether the viewer can DM the target (used by the Message button).
    const canMessage =
      viewerId === targetUserId
        ? false
        : sharedCircleIds.length > 0 ||
          (await hasAcceptedUserConnection(viewerId, targetUserId));

    res.json({
      id: targetUser.id,
      displayName: targetUser.displayName,
      firstName: targetUser.firstName,
      pronouns: targetUser.pronouns ?? null,
      bio: targetUser.bio,
      location: targetUser.location,
      avatarObjectPath: targetUser.avatarObjectPath,
      commonCircleCount: sharedCircleIds.length,
      sharedCircles: visibleCircles.map((c) => ({
        id: c.id,
        name: c.name,
        // Mark which ones are actually shared with the viewer vs. just
        // public-on-profile, so the UI can label them differently.
        isShared: sharedCircleIds.includes(c.id),
      })),
      connection,
      canMessage,
      memberSince: targetUser.createdAt,
    });
  },
);

export default router;
