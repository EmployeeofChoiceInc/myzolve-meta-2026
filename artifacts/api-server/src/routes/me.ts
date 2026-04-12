import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

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

router.patch("/me", requireAuth, async (req, res) => {
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
