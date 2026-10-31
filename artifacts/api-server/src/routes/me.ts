import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  usersTable,
  circlesTable,
  circleMembersTable,
  orgsTable,
  orgMembersTable,
  memberSkillsTable,
  memberResourcesTable,
} from "@workspace/db";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { validateAndConsumePendingUpload } from "../lib/uploadTokens";
import { ObjectStorageService } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import {
  bustIsPlusCache,
  FAMILY_PLAN_MEMBER_CAP,
  getPlusStatus,
  isPlusDirect,
} from "../lib/revenuecat";

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  timezone: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  avatarObjectPath: z.string().max(1000).optional(),
  // Public profile additions (Task #95):
  pronouns: z.string().max(50).nullable().optional(),
  // Phone is freeform; we don't validate beyond a sane length cap.
  // Empty-string is treated as "clear" by trimming below.
  phone: z.string().max(40).nullable().optional(),
  phoneDiscoverable: z.boolean().optional(),
  profileShowCirclesDefault: z.boolean().optional(),
});

const memberSkillInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
});
const memberSkillUpdateSchema = memberSkillInputSchema;
const memberResourceInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  isAvailable: z.boolean().optional().default(true),
});
const memberResourceUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine((data) => data.label !== undefined || data.isAvailable !== undefined);
const skillIdParam = z.object({ skillId: z.coerce.number().int().positive() });
const resourceIdParam = z.object({ resourceId: z.coerce.number().int().positive() });
const MAX_PROFILE_ENTRIES = 30;

type UserOrg = { id: number; name: string; role: string } | null;

/**
 * The user's active org affiliation, used to render "Member of [Org]" on
 * profile screens. Returns the first active membership (a user is realistically
 * in one org). Not gated on seat status — affiliation is shown even if the
 * org's seat pool has lapsed; entitlement (Plus) is handled separately.
 */
async function getUserOrg(userId: number): Promise<UserOrg> {
  const row = await db
    .select({
      id: orgsTable.id,
      name: orgsTable.name,
      role: orgMembersTable.role,
    })
    .from(orgMembersTable)
    .innerJoin(orgsTable, eq(orgsTable.id, orgMembersTable.orgId))
    .where(
      and(
        eq(orgMembersTable.userId, userId),
        eq(orgMembersTable.status, "active"),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  return row ? { id: row.id, name: row.name, role: row.role } : null;
}

function userToApi(user: typeof usersTable.$inferSelect, org: UserOrg = null) {
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
    pronouns: user.pronouns ?? null,
    phone: user.phone ?? null,
    phoneDiscoverable: !!user.phoneDiscoverable,
    profileShowCirclesDefault: user.profileShowCirclesDefault !== false,
    avatarObjectPath: user.avatarObjectPath ?? null,
    planKind: user.planKind === "family" ? "family" : "solo",
    familyCircleId: user.familyCircleId ?? null,
    org,
    createdAt: user.createdAt,
  };
}

router.get("/me", requireAuth, async (req, res) => {
  const org = await getUserOrg(req.dbUser!.id);
  res.json(userToApi(req.dbUser!, org));
});

router.get("/me/skills", requireAuth, async (req, res) => {
  const skills = await db
    .select()
    .from(memberSkillsTable)
    .where(eq(memberSkillsTable.userId, req.dbUser!.id))
    .orderBy(asc(memberSkillsTable.label), asc(memberSkillsTable.id));
  res.json(skills);
});

router.post(
  "/me/skills",
  requireAuth,
  validateBody(memberSkillInputSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { label } = req.body as z.infer<typeof memberSkillInputSchema>;
    const existing = await db
      .select({ label: memberSkillsTable.label })
      .from(memberSkillsTable)
      .where(eq(memberSkillsTable.userId, userId));

    if (existing.some((entry) => entry.label.toLowerCase() === label.toLowerCase())) {
      res.status(409).json({ error: "duplicate_skill" });
      return;
    }
    if (existing.length >= MAX_PROFILE_ENTRIES) {
      res.status(409).json({ error: "skill_limit_reached" });
      return;
    }

    const [created] = await db
      .insert(memberSkillsTable)
      .values({ userId, label })
      .returning();
    res.status(201).json(created);
  },
);

router.patch(
  "/me/skills/:skillId",
  requireAuth,
  validateParams(skillIdParam),
  validateBody(memberSkillUpdateSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const skillId = Number(req.params.skillId);
    const { label } = req.body as z.infer<typeof memberSkillUpdateSchema>;
    const existingSkills = await db
      .select({ id: memberSkillsTable.id, label: memberSkillsTable.label })
      .from(memberSkillsTable)
      .where(eq(memberSkillsTable.userId, userId));
    const current = existingSkills.find((skill) => skill.id === skillId);

    if (!current) {
      res.status(404).json({ error: "skill_not_found" });
      return;
    }
    if (
      existingSkills.some(
        (skill) => skill.id !== skillId && skill.label.toLowerCase() === label.toLowerCase(),
      )
    ) {
      res.status(409).json({ error: "duplicate_skill" });
      return;
    }

    const [updated] = await db
      .update(memberSkillsTable)
      .set({ label })
      .where(and(eq(memberSkillsTable.id, skillId), eq(memberSkillsTable.userId, userId)))
      .returning();
    res.json(updated);
  },
);

router.delete(
  "/me/skills/:skillId",
  requireAuth,
  validateParams(skillIdParam),
  async (req, res) => {
    const skillId = Number(req.params.skillId);
    const [removed] = await db
      .delete(memberSkillsTable)
      .where(and(eq(memberSkillsTable.id, skillId), eq(memberSkillsTable.userId, req.dbUser!.id)))
      .returning({ id: memberSkillsTable.id });

    if (!removed) {
      res.status(404).json({ error: "skill_not_found" });
      return;
    }
    res.status(204).end();
  },
);

router.get("/me/resources", requireAuth, async (req, res) => {
  const resources = await db
    .select()
    .from(memberResourcesTable)
    .where(eq(memberResourcesTable.userId, req.dbUser!.id))
    .orderBy(asc(memberResourcesTable.label), asc(memberResourcesTable.id));
  res.json(resources);
});

router.post(
  "/me/resources",
  requireAuth,
  validateBody(memberResourceInputSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const { label, isAvailable } = req.body as z.infer<typeof memberResourceInputSchema>;
    const existing = await db
      .select({ label: memberResourcesTable.label })
      .from(memberResourcesTable)
      .where(eq(memberResourcesTable.userId, userId));

    if (existing.some((entry) => entry.label.toLowerCase() === label.toLowerCase())) {
      res.status(409).json({ error: "duplicate_resource" });
      return;
    }
    if (existing.length >= MAX_PROFILE_ENTRIES) {
      res.status(409).json({ error: "resource_limit_reached" });
      return;
    }

    const [created] = await db
      .insert(memberResourcesTable)
      .values({ userId, label, isAvailable })
      .returning();
    res.status(201).json(created);
  },
);

router.patch(
  "/me/resources/:resourceId",
  requireAuth,
  validateParams(resourceIdParam),
  validateBody(memberResourceUpdateSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const resourceId = Number(req.params.resourceId);
    const updates = req.body as z.infer<typeof memberResourceUpdateSchema>;
    const existingResources = await db
      .select({ id: memberResourcesTable.id, label: memberResourcesTable.label })
      .from(memberResourcesTable)
      .where(eq(memberResourcesTable.userId, userId));
    const current = existingResources.find((resource) => resource.id === resourceId);

    if (!current) {
      res.status(404).json({ error: "resource_not_found" });
      return;
    }
    if (
      updates.label &&
      existingResources.some(
        (resource) =>
          resource.id !== resourceId &&
          resource.label.toLowerCase() === updates.label!.toLowerCase(),
      )
    ) {
      res.status(409).json({ error: "duplicate_resource" });
      return;
    }

    const [updated] = await db
      .update(memberResourcesTable)
      .set(updates)
      .where(
        and(
          eq(memberResourcesTable.id, resourceId),
          eq(memberResourcesTable.userId, userId),
        ),
      )
      .returning();
    res.json(updated);
  },
);

router.delete(
  "/me/resources/:resourceId",
  requireAuth,
  validateParams(resourceIdParam),
  async (req, res) => {
    const resourceId = Number(req.params.resourceId);
    const [removed] = await db
      .delete(memberResourcesTable)
      .where(
        and(
          eq(memberResourcesTable.id, resourceId),
          eq(memberResourcesTable.userId, req.dbUser!.id),
        ),
      )
      .returning({ id: memberResourcesTable.id });

    if (!removed) {
      res.status(404).json({ error: "resource_not_found" });
      return;
    }
    res.status(204).end();
  },
);

router.patch("/me", requireAuth, validateBody(updateProfileSchema), async (req, res) => {
  const user = req.dbUser!;
  const {
    displayName,
    firstName,
    lastName,
    timezone,
    bio,
    location,
    avatarObjectPath,
    pronouns,
    phone,
    phoneDiscoverable,
    profileShowCirclesDefault,
  } = req.body as {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    timezone?: string;
    bio?: string;
    location?: string;
    avatarObjectPath?: string;
    pronouns?: string | null;
    phone?: string | null;
    phoneDiscoverable?: boolean;
    profileShowCirclesDefault?: boolean;
  };

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

  // Normalize pronouns / phone: trim whitespace, treat empty string as null
  // so the column actually clears when the user wipes the field.
  const normalizedPronouns =
    pronouns === undefined ? undefined : pronouns === null ? null : pronouns.trim() || null;
  const normalizedPhone =
    phone === undefined ? undefined : phone === null ? null : phone.trim() || null;

  // If the user clears their phone, also force phoneDiscoverable off so we
  // don't leave a "discoverable null phone" in a confusing state.
  const effectiveDiscoverable =
    normalizedPhone === null
      ? false
      : phoneDiscoverable;

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
      ...(normalizedPronouns !== undefined && { pronouns: normalizedPronouns }),
      ...(normalizedPhone !== undefined && { phone: normalizedPhone }),
      ...(effectiveDiscoverable !== undefined && {
        phoneDiscoverable: effectiveDiscoverable,
      }),
      ...(profileShowCirclesDefault !== undefined && {
        profileShowCirclesDefault,
      }),
    })
    .where(eq(usersTable.id, user.id))
    .returning();

  const org = await getUserOrg(updated.id);
  res.json(userToApi(updated, org));
});

// PATCH /me/circles/:circleId/visibility — per-membership "show on profile"
// override. Only affects the public profile listing of circles, not access.
const visibilityParam = z.object({
  circleId: z.coerce.number().int().positive(),
});
const visibilityBody = z.object({
  showOnProfile: z.boolean(),
});

router.patch(
  "/me/circles/:circleId/visibility",
  requireAuth,
  validateBody(visibilityBody),
  async (req, res) => {
    const user = req.dbUser!;
    const parsed = visibilityParam.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid circle id" });
      return;
    }
    const { circleId } = parsed.data;
    const { showOnProfile } = req.body as { showOnProfile: boolean };

    const member = await db
      .select({ id: circleMembersTable.id })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.userId, user.id),
          eq(circleMembersTable.status, "active"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!member) {
      res.status(404).json({ error: "You are not a member of this circle" });
      return;
    }
    await db
      .update(circleMembersTable)
      .set({ showOnProfile })
      .where(eq(circleMembersTable.id, member.id));
    res.json({ circleId, showOnProfile });
  },
);

// GET /me/circle-visibility — returns each of my active memberships with
// their `showOnProfile` flag and circle name, so Settings can render a
// per-circle override list.
router.get("/me/circle-visibility", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const rows = await db
    .select({
      circleId: circleMembersTable.circleId,
      showOnProfile: circleMembersTable.showOnProfile,
      circleName: circlesTable.name,
    })
    .from(circleMembersTable)
    .innerJoin(circlesTable, eq(circleMembersTable.circleId, circlesTable.id))
    .where(
      and(
        eq(circleMembersTable.userId, userId),
        eq(circleMembersTable.status, "active"),
      ),
    );
  res.json(rows.map((r) => ({
    circleId: r.circleId,
    circleName: r.circleName,
    showOnProfile: r.showOnProfile !== false,
  })));
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

router.get("/me/plus-status", requireAuth, async (req, res) => {
  const user = req.dbUser!;
  const status = await getPlusStatus({
    id: user.id,
    clerkId: user.clerkId,
    planKind: user.planKind,
    familyCircleId: user.familyCircleId ?? null,
  });
  res.json(status);
});

// We deliberately allow `planKind: "family"` without a `familyCircleId`. That
// represents the user picking the family plan at the paywall and intending to
// designate a family circle later in Settings → Plus. Derived Plus simply
// stays off until a circle is chosen.
const updatePlusPlanSchema = z.object({
  planKind: z.enum(["solo", "family"]),
  familyCircleId: z.number().int().positive().nullable().optional(),
});

router.patch(
  "/me/plus-plan",
  requireAuth,
  validateBody(updatePlusPlanSchema),
  async (req, res) => {
    const user = req.dbUser!;
    // Designating a family circle, or even just declaring intent to switch to
    // a family plan, is only available to users who actually paid for Plus.
    // We deliberately use the *direct* check — derived recipients can't
    // re-gift Plus to yet another circle.
    //
    // PaywallSheet calls this endpoint immediately after a successful
    // purchase, so the in-memory entitlement cache may still hold a stale
    // "no plus" reading from before the purchase. Bust it first so the
    // freshly-completed transaction is honored.
    bustIsPlusCache(user.clerkId);
    const direct = await isPlusDirect(user.clerkId);
    if (!direct) {
      res.status(402).json({
        error: "plus_required",
        reason: "plan_change",
        message:
          "Subscribe to MyZolve Connect Plus before switching to a family plan.",
      });
      return;
    }

    const body = req.body as {
      planKind: "solo" | "family";
      familyCircleId?: number | null;
    };

    // Resolve the next familyCircleId per body semantics:
    //   - planKind=family + circleId given: validate ownership, set it.
    //   - planKind=family + circleId null: clear designation (pending).
    //   - planKind=family + key omitted: leave existing designation alone.
    //   - planKind=solo + circleId null: clear designation.
    //   - planKind=solo + key omitted: leave existing designation alone.
    let nextFamilyCircleId: number | null;
    if (body.planKind === "family" && typeof body.familyCircleId === "number") {
      // The caller must own the chosen circle. We rely on `circles.ownerId`
      // here (transferred ownership flows through this column too).
      const circle = await db
        .select({
          id: circlesTable.id,
          ownerId: circlesTable.ownerId,
        })
        .from(circlesTable)
        .where(eq(circlesTable.id, body.familyCircleId))
        .limit(1)
        .then((r) => r[0]);
      if (!circle) {
        res.status(400).json({
          error: "invalid_family_circle",
          message: "That circle no longer exists.",
        });
        return;
      }
      if (circle.ownerId !== user.id) {
        res.status(400).json({
          error: "invalid_family_circle",
          message: "You can only designate a circle you own as the family circle.",
        });
        return;
      }
      nextFamilyCircleId = circle.id;
    } else if (body.familyCircleId === null) {
      nextFamilyCircleId = null;
    } else {
      nextFamilyCircleId = user.familyCircleId ?? null;
    }

    await db
      .update(usersTable)
      .set({
        planKind: body.planKind,
        familyCircleId: nextFamilyCircleId,
      })
      .where(eq(usersTable.id, user.id));

    // Bust the entitlement cache for the owner so their derived state and
    // member counts surface immediately. We can't easily bust derived
    // recipients here without an N-query lookup; the 60s TTL bounds drift.
    bustIsPlusCache(user.clerkId);

    let memberCount: number | null = null;
    if (body.planKind === "family" && nextFamilyCircleId != null) {
      const [row] = await db
        .select({ cnt: count() })
        .from(circleMembersTable)
        .where(
          and(
            eq(circleMembersTable.circleId, nextFamilyCircleId),
            eq(circleMembersTable.status, "active"),
          ),
        );
      memberCount = Number(row?.cnt ?? 0);
    }

    const status = await getPlusStatus({
      id: user.id,
      clerkId: user.clerkId,
      planKind: body.planKind,
      familyCircleId: nextFamilyCircleId,
    });

    logger.info(
      {
        userId: user.id,
        planKind: body.planKind,
        familyCircleId: nextFamilyCircleId,
        memberCount,
        cap: FAMILY_PLAN_MEMBER_CAP,
      },
      "Plus plan updated",
    );

    res.json(status);
  },
);

export default router;
