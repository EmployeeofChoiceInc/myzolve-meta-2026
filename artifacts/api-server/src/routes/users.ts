import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateParams } from "../middlewares/validate";
import { db } from "@workspace/db";
import { usersTable, circleMembersTable, circlesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const router = Router();

const userIdParam = z.object({
  userId: z.coerce.number().int().positive(),
});

router.get("/users/:userId/profile", requireAuth, validateParams(userIdParam), async (req, res) => {
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

  const myCircles = await db
    .select({ circleId: circleMembersTable.circleId })
    .from(circleMembersTable)
    .where(and(eq(circleMembersTable.userId, viewerId), eq(circleMembersTable.status, "active")));

  const myCircleIds = new Set(myCircles.map((m) => m.circleId));

  const theirCircles = await db
    .select({ circleId: circleMembersTable.circleId })
    .from(circleMembersTable)
    .where(and(eq(circleMembersTable.userId, targetUserId), eq(circleMembersTable.status, "active")));

  const sharedCircleIds = theirCircles
    .filter((m) => myCircleIds.has(m.circleId))
    .map((m) => m.circleId);
  const commonCircleCount = sharedCircleIds.length;

  if (viewerId !== targetUserId && commonCircleCount === 0) {
    res.status(403).json({ error: "You must share a circle with this member to view their profile" });
    return;
  }

  const sharedCircles =
    sharedCircleIds.length > 0
      ? await db
          .select({ id: circlesTable.id, name: circlesTable.name })
          .from(circlesTable)
          .where(inArray(circlesTable.id, sharedCircleIds))
      : [];

  res.json({
    id: targetUser.id,
    displayName: targetUser.displayName,
    firstName: targetUser.firstName,
    bio: targetUser.bio,
    location: targetUser.location,
    avatarObjectPath: targetUser.avatarObjectPath,
    commonCircleCount,
    sharedCircles,
    memberSince: targetUser.createdAt,
  });
});

export default router;
