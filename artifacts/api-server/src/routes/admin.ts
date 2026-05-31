import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import {
  db,
  compsTable,
  usersTable,
  orgsTable,
  orgMembersTable,
  type Comp,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { validateBody, validateParams } from "../middlewares/validate";
import { bustIsPlusCache } from "../lib/revenuecat";
import { logger } from "../lib/logger";

const router = Router();

// All admin routes require an authenticated program admin.
router.use("/admin", requireAuth, requireAdmin);

/**
 * Lightweight probe so the web admin page can decide whether to render. Returns
 * 200 for admins; requireAdmin returns 403 for everyone else.
 */
router.get("/admin/check", (_req, res) => {
  res.json({ ok: true });
});

// --- helpers ---------------------------------------------------------------

function compToApi(
  comp: Comp,
  extra: {
    userEmail?: string | null;
    userName?: string | null;
    orgName?: string | null;
    grantedByName?: string | null;
  } = {},
) {
  const now = Date.now();
  const expired =
    comp.expiresAt != null && comp.expiresAt.getTime() <= now;
  const active = comp.revokedAt == null && !expired;
  return {
    id: comp.id,
    targetType: comp.targetType,
    userId: comp.userId,
    orgId: comp.orgId,
    userEmail: extra.userEmail ?? null,
    userName: extra.userName ?? null,
    orgName: extra.orgName ?? null,
    reason: comp.reason ?? null,
    expiresAt: comp.expiresAt ? comp.expiresAt.toISOString() : null,
    revokedAt: comp.revokedAt ? comp.revokedAt.toISOString() : null,
    grantedByUserId: comp.grantedByUserId,
    grantedByName: extra.grantedByName ?? null,
    active,
    createdAt: comp.createdAt.toISOString(),
  };
}

function expiresAtFromDurationDays(durationDays: number | null): Date | null {
  if (durationDays == null) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + durationDays);
  return d;
}

/**
 * Revoke any currently-active comps for a target before granting a new one, so
 * there is at most one active comp per user/org. This keeps revocation
 * deterministic (revoking "the" active comp actually withdraws access) and
 * matches the CLI's single-active-grant behavior.
 */
async function revokeActiveCompsForTarget(
  target: { userId: number } | { orgId: number },
  now: Date,
): Promise<void> {
  const isUser = "userId" in target;
  await db
    .update(compsTable)
    .set({ revokedAt: now })
    .where(
      and(
        eq(compsTable.targetType, isUser ? "user" : "org"),
        isUser
          ? eq(compsTable.userId, target.userId)
          : eq(compsTable.orgId, target.orgId),
        isNull(compsTable.revokedAt),
        or(isNull(compsTable.expiresAt), gt(compsTable.expiresAt, now)),
      ),
    );
}

// --- list comps ------------------------------------------------------------

router.get("/admin/comps", async (_req, res) => {
  const comps = await db
    .select()
    .from(compsTable)
    .orderBy(desc(compsTable.createdAt));

  const userIds = new Set<number>();
  const orgIds = new Set<number>();
  for (const c of comps) {
    if (c.userId != null) userIds.add(c.userId);
    if (c.orgId != null) orgIds.add(c.orgId);
    if (c.grantedByUserId != null) userIds.add(c.grantedByUserId);
  }

  const userRows = userIds.size
    ? await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          displayName: usersTable.displayName,
        })
        .from(usersTable)
        .where(inArray(usersTable.id, Array.from(userIds)))
    : [];
  const orgRows = orgIds.size
    ? await db
        .select({ id: orgsTable.id, name: orgsTable.name })
        .from(orgsTable)
        .where(inArray(orgsTable.id, Array.from(orgIds)))
    : [];

  const userById = new Map(userRows.map((u) => [u.id, u]));
  const orgById = new Map(orgRows.map((o) => [o.id, o]));

  res.json(
    comps.map((c) =>
      compToApi(c, {
        userEmail: c.userId != null ? userById.get(c.userId)?.email ?? null : null,
        userName:
          c.userId != null ? userById.get(c.userId)?.displayName ?? null : null,
        orgName: c.orgId != null ? orgById.get(c.orgId)?.name ?? null : null,
        grantedByName:
          c.grantedByUserId != null
            ? userById.get(c.grantedByUserId)?.displayName ?? null
            : null,
      }),
    ),
  );
});

// --- grant a user comp -----------------------------------------------------

const grantUserSchema = z.object({
  email: z.string().trim().email().max(320),
  durationDays: z.number().int().positive().max(3650).nullable().optional(),
  reason: z.string().trim().max(2000).nullable().optional(),
});

router.post(
  "/admin/comps/user",
  validateBody(grantUserSchema),
  async (req, res) => {
    const { email, durationDays, reason } = req.body as z.infer<
      typeof grantUserSchema
    >;

    const target = await db
      .select({ id: usersTable.id, clerkId: usersTable.clerkId })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!target) {
      res.status(404).json({
        error: "NotFound",
        message: `No user found with email ${email}. They must sign in at least once first.`,
      });
      return;
    }

    const expiresAt = expiresAtFromDurationDays(durationDays ?? null);

    // Supersede any existing active comp so there is one active comp per user.
    await revokeActiveCompsForTarget({ userId: target.id }, new Date());

    const [created] = await db
      .insert(compsTable)
      .values({
        targetType: "user",
        userId: target.id,
        expiresAt,
        reason: reason ?? null,
        grantedByUserId: req.dbUser!.id,
      })
      .returning();

    // The Plus check caches per Clerk id for ~60s; bust it so the grant takes
    // effect immediately for the target.
    if (target.clerkId) bustIsPlusCache(target.clerkId);

    logger.info(
      { compId: created!.id, userId: target.id, by: req.dbUser!.id },
      "admin granted user comp",
    );
    res.status(201).json(compToApi(created!));
  },
);

// --- grant an org comp -----------------------------------------------------

const grantOrgSchema = z
  .object({
    orgId: z.number().int().positive().optional(),
    ownerEmail: z.string().trim().email().max(320).optional(),
    durationDays: z.number().int().positive().max(3650).nullable().optional(),
    reason: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.orgId != null || v.ownerEmail != null, {
    message: "Provide either orgId or ownerEmail",
  });

router.post(
  "/admin/comps/org",
  validateBody(grantOrgSchema),
  async (req, res) => {
    const { orgId, ownerEmail, durationDays, reason } = req.body as z.infer<
      typeof grantOrgSchema
    >;

    let org: { id: number; name: string } | null = null;
    if (orgId != null) {
      org = await db
        .select({ id: orgsTable.id, name: orgsTable.name })
        .from(orgsTable)
        .where(eq(orgsTable.id, orgId))
        .limit(1)
        .then((r) => r[0] ?? null);
    } else if (ownerEmail) {
      org = await db
        .select({ id: orgsTable.id, name: orgsTable.name })
        .from(orgsTable)
        .innerJoin(usersTable, eq(usersTable.id, orgsTable.ownerId))
        .where(eq(usersTable.email, ownerEmail.toLowerCase()))
        .orderBy(desc(orgsTable.createdAt))
        .limit(1)
        .then((r) => r[0] ?? null);
    }

    if (!org) {
      res.status(404).json({
        error: "NotFound",
        message: orgId
          ? `No org found with id ${orgId}.`
          : `No org found owned by ${ownerEmail}.`,
      });
      return;
    }

    const expiresAt = expiresAtFromDurationDays(durationDays ?? null);

    // Supersede any existing active comp so there is one active comp per org.
    await revokeActiveCompsForTarget({ orgId: org.id }, new Date());

    const [created] = await db
      .insert(compsTable)
      .values({
        targetType: "org",
        orgId: org.id,
        expiresAt,
        reason: reason ?? null,
        grantedByUserId: req.dbUser!.id,
      })
      .returning();

    // Bust the Plus cache for every active member so the org comp applies
    // immediately across the whole reunion/org.
    const members = await db
      .select({ clerkId: usersTable.clerkId })
      .from(orgMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, orgMembersTable.userId))
      .where(
        and(
          eq(orgMembersTable.orgId, org.id),
          eq(orgMembersTable.status, "active"),
        ),
      );
    for (const m of members) {
      if (m.clerkId) bustIsPlusCache(m.clerkId);
    }

    logger.info(
      { compId: created!.id, orgId: org.id, by: req.dbUser!.id },
      "admin granted org comp",
    );
    res.status(201).json(compToApi(created!, { orgName: org.name }));
  },
);

// --- revoke a comp ---------------------------------------------------------

const compIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

router.post(
  "/admin/comps/:id/revoke",
  validateParams(compIdParam),
  async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof compIdParam>;

    const existing = await db
      .select()
      .from(compsTable)
      .where(eq(compsTable.id, id))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!existing) {
      res.status(404).json({ error: "NotFound" });
      return;
    }

    if (existing.revokedAt != null) {
      res.json(compToApi(existing));
      return;
    }

    const [updated] = await db
      .update(compsTable)
      .set({ revokedAt: new Date() })
      .where(eq(compsTable.id, id))
      .returning();

    // Bust caches for affected users so access is withdrawn promptly.
    if (updated!.targetType === "user" && updated!.userId != null) {
      const u = await db
        .select({ clerkId: usersTable.clerkId })
        .from(usersTable)
        .where(eq(usersTable.id, updated!.userId))
        .limit(1)
        .then((r) => r[0] ?? null);
      if (u?.clerkId) bustIsPlusCache(u.clerkId);
    } else if (updated!.targetType === "org" && updated!.orgId != null) {
      const members = await db
        .select({ clerkId: usersTable.clerkId })
        .from(orgMembersTable)
        .innerJoin(usersTable, eq(usersTable.id, orgMembersTable.userId))
        .where(
          and(
            eq(orgMembersTable.orgId, updated!.orgId),
            eq(orgMembersTable.status, "active"),
          ),
        );
      for (const m of members) {
        if (m.clerkId) bustIsPlusCache(m.clerkId);
      }
    }

    logger.info(
      { compId: id, by: req.dbUser!.id },
      "admin revoked comp",
    );
    res.json(compToApi(updated!));
  },
);

export default router;
