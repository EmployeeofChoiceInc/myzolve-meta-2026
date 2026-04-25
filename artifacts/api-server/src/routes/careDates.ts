import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, validateQuery, circleIdParam } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  careDatesTable,
  circleMembersTable,
  circlesTable,
  usersTable,
} from "@workspace/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { assertCircleMember } from "../lib/helpers";

const router = Router();

const careDateIdParam = z.object({
  circleId: z.coerce.number().int().positive(),
  careDateId: z.coerce.number().int().positive(),
});

const KIND_VALUES = ["birthday", "anniversary", "memorial", "appointment", "other"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  name: z.string().min(1).max(200),
  eventDate: z.string().regex(ISO_DATE, "Use YYYY-MM-DD"),
  kind: z.enum(KIND_VALUES).optional().default("other"),
  note: z.string().max(2000).optional(),
  isAnnual: z.boolean().optional().default(false),
  targetUserId: z.number().int().positive().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  eventDate: z.string().regex(ISO_DATE).optional(),
  kind: z.enum(KIND_VALUES).optional(),
  note: z.string().max(2000).nullable().optional(),
  isAnnual: z.boolean().optional(),
  targetUserId: z.number().int().positive().nullable().optional(),
});

const upcomingQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
  withinDays: z.coerce.number().int().min(1).max(365).optional().default(14),
});

function todayIsoUTC(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Compute the next occurrence (YYYY-MM-DD) of a care date as of `today`.
 * For one-off entries, returns `eventDate` as-is even if in the past — UI
 * can decide whether to show. For annual entries, rolls the month/day
 * forward to today's year (or next year if already passed).
 */
export function nextOccurrenceFor(eventDate: string, isAnnual: boolean, today: string = todayIsoUTC()): string {
  if (!isAnnual) return eventDate;
  const [, mm, dd] = eventDate.split("-");
  const [ty, tm, td] = today.split("-");
  const candidate = `${ty}-${mm}-${dd}`;
  if (candidate >= `${ty}-${tm}-${td}`) return candidate;
  const nextYear = String(parseInt(ty, 10) + 1).padStart(4, "0");
  return `${nextYear}-${mm}-${dd}`;
}

function rowToApi(
  row: typeof careDatesTable.$inferSelect,
  ctx: { circleName?: string | null; targetUserName?: string | null },
  today: string,
) {
  return {
    id: row.id,
    circleId: row.circleId,
    circleName: ctx.circleName ?? null,
    createdByUserId: row.createdByUserId,
    targetUserId: row.targetUserId,
    targetUserName: ctx.targetUserName ?? null,
    name: row.name,
    eventDate: row.eventDate,
    nextOccurrence: nextOccurrenceFor(row.eventDate, row.isAnnual, today),
    kind: row.kind,
    note: row.note,
    isAnnual: row.isAnnual,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get(
  "/circles/:circleId/care-dates",
  requireAuth,
  validateParams(circleIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const rows = await db
      .select({ d: careDatesTable, target: usersTable })
      .from(careDatesTable)
      .leftJoin(usersTable, eq(careDatesTable.targetUserId, usersTable.id))
      .where(eq(careDatesTable.circleId, circleId));

    const today = todayIsoUTC();
    const enriched = rows.map((r) =>
      rowToApi(r.d, { targetUserName: r.target?.displayName ?? null }, today),
    );
    enriched.sort((a, b) => a.nextOccurrence.localeCompare(b.nextOccurrence));
    res.json(enriched);
  },
);

router.post(
  "/circles/:circleId/care-dates",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(createSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const { name, eventDate, kind, note, isAnnual, targetUserId } = req.body;

    if (targetUserId !== undefined && targetUserId !== null) {
      const targetMember = await assertCircleMember(circleId, targetUserId);
      if (!targetMember) {
        res.status(400).json({ error: "Target user must be a member of this circle" });
        return;
      }
    }

    const [row] = await db
      .insert(careDatesTable)
      .values({
        circleId,
        createdByUserId: userId,
        targetUserId: targetUserId ?? null,
        name,
        eventDate,
        kind: kind ?? "other",
        note: note ?? null,
        isAnnual: !!isAnnual,
      })
      .returning();

    let targetName: string | null = null;
    if (row.targetUserId) {
      const t = await db
        .select({ displayName: usersTable.displayName })
        .from(usersTable)
        .where(eq(usersTable.id, row.targetUserId))
        .limit(1)
        .then((r) => r[0]);
      targetName = t?.displayName ?? null;
    }

    res.status(201).json(rowToApi(row, { targetUserName: targetName }, todayIsoUTC()));
  },
);

router.patch(
  "/circles/:circleId/care-dates/:careDateId",
  requireAuth,
  validateParams(careDateIdParam),
  validateBody(updateSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const careDateId = parseInt(String(req.params.careDateId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const existing = await db
      .select()
      .from(careDatesTable)
      .where(and(eq(careDatesTable.id, careDateId), eq(careDatesTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!existing) {
      res.status(404).json({ error: "Care date not found" });
      return;
    }

    // The care calendar is shared: any active circle member can edit
    // entries so the group can keep the calendar accurate together.
    void member;

    const patch = req.body as z.infer<typeof updateSchema>;

    if (patch.targetUserId !== undefined && patch.targetUserId !== null) {
      const targetMember = await assertCircleMember(circleId, patch.targetUserId);
      if (!targetMember) {
        res.status(400).json({ error: "Target user must be a member of this circle" });
        return;
      }
    }

    const update: Partial<typeof careDatesTable.$inferInsert> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.eventDate !== undefined) {
      update.eventDate = patch.eventDate;
      // Editing the date invalidates the previous reminder dedupe so we
      // don't accidentally suppress a reminder for the new occurrence.
      update.lastRemindedFor = null;
    }
    if (patch.kind !== undefined) update.kind = patch.kind;
    if (patch.note !== undefined) update.note = patch.note;
    if (patch.isAnnual !== undefined) {
      update.isAnnual = patch.isAnnual;
      update.lastRemindedFor = null;
    }
    if (patch.targetUserId !== undefined) update.targetUserId = patch.targetUserId;

    const [row] = await db
      .update(careDatesTable)
      .set(update)
      .where(eq(careDatesTable.id, careDateId))
      .returning();

    let targetName: string | null = null;
    if (row.targetUserId) {
      const t = await db
        .select({ displayName: usersTable.displayName })
        .from(usersTable)
        .where(eq(usersTable.id, row.targetUserId))
        .limit(1)
        .then((r) => r[0]);
      targetName = t?.displayName ?? null;
    }

    res.json(rowToApi(row, { targetUserName: targetName }, todayIsoUTC()));
  },
);

router.delete(
  "/circles/:circleId/care-dates/:careDateId",
  requireAuth,
  validateParams(careDateIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const careDateId = parseInt(String(req.params.careDateId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const existing = await db
      .select()
      .from(careDatesTable)
      .where(and(eq(careDatesTable.id, careDateId), eq(careDatesTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!existing) {
      res.status(404).json({ error: "Care date not found" });
      return;
    }

    // Shared calendar: any active member can remove entries so the
    // group can prune outdated dates together.
    void member;
    void userId;

    await db.delete(careDatesTable).where(eq(careDatesTable.id, careDateId));
    res.status(204).end();
  },
);

router.get(
  "/care-dates/upcoming",
  requireAuth,
  validateQuery(upcomingQuery),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { limit, withinDays } = req.query as unknown as { limit: number; withinDays: number };

    const myCircles = await db
      .select({ circleId: circleMembersTable.circleId })
      .from(circleMembersTable)
      .where(and(eq(circleMembersTable.userId, userId), eq(circleMembersTable.status, "active")));
    const circleIds = myCircles.map((c) => c.circleId);
    if (circleIds.length === 0) {
      res.json([]);
      return;
    }

    const rows = await db
      .select({
        d: careDatesTable,
        circle: circlesTable,
        target: usersTable,
      })
      .from(careDatesTable)
      .innerJoin(circlesTable, eq(careDatesTable.circleId, circlesTable.id))
      .leftJoin(usersTable, eq(careDatesTable.targetUserId, usersTable.id))
      .where(inArray(careDatesTable.circleId, circleIds));

    const today = todayIsoUTC();
    const cutoff = new Date(today + "T00:00:00Z");
    cutoff.setUTCDate(cutoff.getUTCDate() + withinDays);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const enriched = rows
      .map((r) =>
        rowToApi(
          r.d,
          { circleName: r.circle.name, targetUserName: r.target?.displayName ?? null },
          today,
        ),
      )
      .filter((r) => r.nextOccurrence >= today && r.nextOccurrence <= cutoffIso);
    enriched.sort((a, b) => a.nextOccurrence.localeCompare(b.nextOccurrence));
    res.json(enriched.slice(0, limit));
  },
);

export default router;
