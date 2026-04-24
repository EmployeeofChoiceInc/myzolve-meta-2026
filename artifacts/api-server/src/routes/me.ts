import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  usersTable,
  circlesTable,
  circleMembersTable,
} from "@workspace/db";
import { and, asc, eq, ne } from "drizzle-orm";
import { validateAndConsumePendingUpload } from "../lib/uploadTokens";
import { ObjectStorageService } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  timezone: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  avatarObjectPath: z.string().max(1000).optional(),
});

function userToApi(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    clerkId: user.clerkId,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    timezone: user.timezone,
    bio: user.bio,
    location: user.location,
    avatarObjectPath: user.avatarObjectPath ?? null,
    createdAt: user.createdAt,
  };
}

router.get("/me", requireAuth, async (req, res) => {
  res.json(userToApi(req.dbUser!));
});

router.patch("/me", requireAuth, validateBody(updateProfileSchema), async (req, res) => {
  const user = req.dbUser!;
  const { displayName, firstName, lastName, timezone, bio, location, avatarObjectPath } = req.body;

  if (
    avatarObjectPath !== undefined &&
    avatarObjectPath !== user.avatarObjectPath
  ) {
    const valid = validateAndConsumePendingUpload(avatarObjectPath, user.id);
    if (!valid) {
      res.status(400).json({
        error: "Invalid avatar: the upload token is missing, expired, or does not belong to you. Please re-upload your photo.",
      });
      return;
    }
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      ...(displayName !== undefined && { displayName }),
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(timezone !== undefined && { timezone }),
      ...(bio !== undefined && { bio }),
      ...(location !== undefined && { location }),
      ...(avatarObjectPath !== undefined && { avatarObjectPath }),
    })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json(userToApi(updated));
});

router.delete("/me", requireAuth, async (req, res) => {
  const user = req.dbUser!;

  // 1. Hand off or remove circles the user owns. Without this, owned
  //    circles would become "zombies" managed by a Deleted user. For each
  //    owned circle: if there is at least one other active member, transfer
  //    ownership to the longest-tenured one; otherwise (the user is alone)
  //    cascade-delete the circle and all its data.
  const ownedCircles = await db
    .select({ id: circlesTable.id })
    .from(circlesTable)
    .where(eq(circlesTable.ownerId, user.id));

  for (const circle of ownedCircles) {
    const successor = await db
      .select({ id: circleMembersTable.id, userId: circleMembersTable.userId })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, circle.id),
          eq(circleMembersTable.status, "active"),
          ne(circleMembersTable.userId, user.id),
        ),
      )
      .orderBy(asc(circleMembersTable.joinedAt), asc(circleMembersTable.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (successor && successor.userId != null) {
      await db.transaction(async (tx) => {
        await tx
          .update(circlesTable)
          .set({ ownerId: successor.userId! })
          .where(eq(circlesTable.id, circle.id));
        await tx
          .update(circleMembersTable)
          .set({ role: "owner" })
          .where(eq(circleMembersTable.id, successor.id));
      });
    } else {
      // No other active members — delete the circle outright. All
      // dependent rows (members, posts, messages, requests, etc.) are
      // removed via ON DELETE CASCADE on circleId.
      await db.delete(circlesTable).where(eq(circlesTable.id, circle.id));
    }
  }

  // 2. Best-effort: remove the user's avatar file from object storage so
  //    no PII binary lingers after anonymization.
  if (user.avatarObjectPath) {
    try {
      const storage = new ObjectStorageService();
      const file = await storage.getObjectEntityFile(user.avatarObjectPath);
      await file.delete({ ignoreNotFound: true });
    } catch (err) {
      logger.warn(
        { err, userId: user.id, path: user.avatarObjectPath },
        "Avatar object delete failed during account deletion",
      );
    }
  }

  // 3. Delete the user from Clerk so they can no longer sign in anywhere.
  //    Active sessions are revoked by Clerk as part of user deletion.
  //    If this fails (e.g. already removed in Clerk), log and continue —
  //    we still want to anonymize our DB row.
  try {
    await clerkClient.users.deleteUser(user.clerkId);
  } catch (err) {
    logger.warn(
      { err, userId: user.id, clerkId: user.clerkId },
      "Clerk user delete failed; proceeding with DB anonymization",
    );
  }

  // 4. Anonymize the DB row. We can't hard-delete because authored content
  //    (remaining circles where the user is a member, requests, services,
  //    comments, posts, connections) has FKs back to userId without ON
  //    DELETE CASCADE. Replacing PII with placeholder values gives the
  //    user the same outcome (their data is gone, they can't sign in)
  //    while preserving referential integrity. Cascading children —
  //    messages, notifications, device tokens, circle memberships, join
  //    requests — are removed automatically by the DB's ON DELETE CASCADE
  //    rules when those rows reference userId.
  const placeholder = `deleted_${user.id}_${randomBytes(8).toString("hex")}`;
  await db
    .update(usersTable)
    .set({
      clerkId: placeholder,
      displayName: "Deleted user",
      email: `${placeholder}@deleted.local`,
      firstName: null,
      lastName: null,
      bio: null,
      location: null,
      avatarObjectPath: null,
    })
    .where(eq(usersTable.id, user.id));

  res.status(204).end();
});

export default router;
