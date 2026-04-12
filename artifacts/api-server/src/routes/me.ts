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
});

router.get("/me", requireAuth, async (req, res) => {
  const user = req.dbUser!;
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    timezone: user.timezone,
    createdAt: user.createdAt,
  });
});

router.patch("/me", requireAuth, validateBody(updateProfileSchema), async (req, res) => {
  const user = req.dbUser!;
  const { displayName, firstName, lastName, timezone } = req.body;

  const [updated] = await db
    .update(usersTable)
    .set({
      ...(displayName !== undefined && { displayName }),
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(timezone !== undefined && { timezone }),
    })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json({
    id: updated.id,
    clerkId: updated.clerkId,
    displayName: updated.displayName,
    firstName: updated.firstName,
    lastName: updated.lastName,
    email: updated.email,
    timezone: updated.timezone,
    createdAt: updated.createdAt,
  });
});

export default router;
