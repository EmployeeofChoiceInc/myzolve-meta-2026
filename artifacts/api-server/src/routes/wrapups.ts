import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate";
import { db } from "@workspace/db";
import { wrapupsTable } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { backfillWrapupForUser } from "../lib/wrapups";

const router = Router();

const kindEnum = z.enum(["weekly", "monthly"]);

const latestQuery = z.object({ kind: kindEnum });
const listQuery = z.object({
  kind: kindEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
const wrapupIdParam = z.object({
  wrapupId: z.coerce.number().int().positive(),
});

function rowToApi(row: typeof wrapupsTable.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    content: row.content,
    readAt: row.readAt,
    deliveredAt: row.deliveredAt,
    createdAt: row.createdAt,
  };
}

router.get(
  "/wrapups/latest",
  requireAuth,
  validateQuery(latestQuery),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { kind } = req.query as unknown as z.infer<typeof latestQuery>;

    const row = await db
      .select()
      .from(wrapupsTable)
      .where(and(eq(wrapupsTable.userId, userId), eq(wrapupsTable.kind, kind)))
      .orderBy(desc(wrapupsTable.periodStart))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!row) {
      res.json(null);
      return;
    }

    // Mark deliveredAt the first time it's fetched so we know when the
    // user actually saw it (separate from readAt, which they tap).
    if (!row.deliveredAt) {
      const [updated] = await db
        .update(wrapupsTable)
        .set({ deliveredAt: new Date() })
        .where(and(eq(wrapupsTable.id, row.id), isNull(wrapupsTable.deliveredAt)))
        .returning();
      if (updated) {
        res.json(rowToApi(updated));
        return;
      }
    }

    res.json(rowToApi(row));
  },
);

router.get("/wrapups", requireAuth, validateQuery(listQuery), async (req, res) => {
  const userId = req.dbUser!.id;
  const { kind, limit, offset } = req.query as unknown as z.infer<typeof listQuery>;

  const conds = [eq(wrapupsTable.userId, userId)];
  if (kind) conds.push(eq(wrapupsTable.kind, kind));

  const rows = await db
    .select()
    .from(wrapupsTable)
    .where(and(...conds))
    .orderBy(desc(wrapupsTable.periodStart))
    .limit(limit)
    .offset(offset);

  res.json(rows.map(rowToApi));
});

router.post(
  "/wrapups/:wrapupId/read",
  requireAuth,
  validateParams(wrapupIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const wrapupId = parseInt(String(req.params.wrapupId));

    const row = await db
      .select()
      .from(wrapupsTable)
      .where(and(eq(wrapupsTable.id, wrapupId), eq(wrapupsTable.userId, userId)))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!row) {
      res.status(404).json({ error: "Wrap-up not found" });
      return;
    }

    let readAt = row.readAt;
    if (!readAt) {
      const [updated] = await db
        .update(wrapupsTable)
        .set({ readAt: new Date() })
        .where(eq(wrapupsTable.id, row.id))
        .returning();
      readAt = updated?.readAt ?? null;
    }

    res.json({ id: row.id, readAt });
  },
);

// Internal: dev-only / QA helper that lets a signed-in user manually
// generate the most recent completed wrap-up for themselves. Useful when
// you need to verify formatting without waiting for Sunday morning.
// Disabled in production to avoid surfacing arbitrary jobs through the
// public surface.
const backfillBody = z.object({ kind: kindEnum });

router.post(
  "/wrapups/_dev/backfill",
  requireAuth,
  validateBody(backfillBody),
  async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const userId = req.dbUser!.id;
    const { kind } = req.body as { kind: "weekly" | "monthly" };
    const id = await backfillWrapupForUser({ userId, kind });
    res.json({ ok: true, wrapupId: id });
  },
);

export default router;
