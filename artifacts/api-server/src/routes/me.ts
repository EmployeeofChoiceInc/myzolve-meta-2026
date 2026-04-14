import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
    avatarObjectPath: user.avatarObjectPath,
    createdAt: user.createdAt,
  };
}

router.get("/me", requireAuth, async (req, res) => {
  res.json(userToApi(req.dbUser!));
});

router.patch("/me", requireAuth, validateBody(updateProfileSchema), async (req, res) => {
  const user = req.dbUser!;
  const { displayName, firstName, lastName, timezone, bio, location, avatarObjectPath } = req.body;

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

export default router;
