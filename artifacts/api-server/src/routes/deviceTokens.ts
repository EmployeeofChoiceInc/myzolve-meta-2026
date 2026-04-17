import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams } from "../middlewares/validate";
import { db } from "@workspace/db";
import { deviceTokensTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();

const registerBodySchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.enum(["ios", "android", "web"]),
});

const tokenParamSchema = z.object({
  token: z.string().min(1).max(500),
});

router.post(
  "/device-tokens",
  requireAuth,
  validateBody(registerBodySchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { token, platform } = req.body as z.infer<typeof registerBodySchema>;

    const existing = await db
      .select()
      .from(deviceTokensTable)
      .where(eq(deviceTokensTable.token, token))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (existing) {
      const [updated] = await db
        .update(deviceTokensTable)
        .set({ userId, platform, lastUsedAt: new Date() })
        .where(eq(deviceTokensTable.id, existing.id))
        .returning();
      res.json({ id: updated.id, token: updated.token, platform: updated.platform });
      return;
    }

    const [inserted] = await db
      .insert(deviceTokensTable)
      .values({ userId, token, platform })
      .returning();
    res.status(201).json({ id: inserted.id, token: inserted.token, platform: inserted.platform });
  },
);

router.delete(
  "/device-tokens/:token",
  requireAuth,
  validateParams(tokenParamSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { token } = req.params as unknown as z.infer<typeof tokenParamSchema>;

    await db
      .delete(deviceTokensTable)
      .where(and(eq(deviceTokensTable.token, token), eq(deviceTokensTable.userId, userId)));

    res.json({ success: true });
  },
);

export default router;
