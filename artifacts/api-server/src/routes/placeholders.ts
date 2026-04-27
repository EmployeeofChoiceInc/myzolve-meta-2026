import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, circleIdParam, validateQuery, paginationQuery } from "../middlewares/validate";
import { db } from "@workspace/db";
import { placeholderMembersTable, circleMembersTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { assertCircleMember, createAuditLog } from "../lib/helpers";
import { canManageMembers } from "../lib/permissions";

const router = Router();

const placeholderIdParam = z.object({
  placeholderId: z.coerce.number().int().positive(),
});

const createPlaceholderSchema = z.object({
  displayName: z.string().min(1).max(100),
  relationship: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  email: z.string().email().optional(),
});

const updatePlaceholderSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  relationship: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  email: z.string().email().optional(),
});

function placeholderToApi(p: typeof placeholderMembersTable.$inferSelect) {
  return {
    id: p.id,
    circleId: p.circleId,
    addedByUserId: p.addedByUserId,
    displayName: p.displayName,
    relationship: p.relationship,
    notes: p.notes,
    email: p.email,
    status: p.status,
    claimedByUserId: p.claimedByUserId,
    claimedAt: p.claimedAt,
    createdAt: p.createdAt,
  };
}

router.get(
  "/circles/:circleId/placeholder-members",
  requireAuth,
  validateParams(circleIdParam),
  validateQuery(paginationQuery),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const rows = await db
      .select()
      .from(placeholderMembersTable)
      .where(eq(placeholderMembersTable.circleId, circleId))
      .orderBy(desc(placeholderMembersTable.createdAt));

    res.json(rows.map(placeholderToApi));
  },
);

router.post(
  "/circles/:circleId/placeholder-members",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(createPlaceholderSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const { displayName, relationship, notes, email } = req.body;

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const isAdminOrOwner = canManageMembers(member.role);
    if (!isAdminOrOwner) {
      res.status(403).json({ error: "Only admins can add placeholder members" });
      return;
    }

    const [placeholder] = await db
      .insert(placeholderMembersTable)
      .values({
        circleId,
        addedByUserId: userId,
        displayName,
        relationship: relationship ?? null,
        notes: notes ?? null,
        email: email ?? null,
        status: "unlinked",
      })
      .returning();

    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: "placeholder_member_added",
      targetEntityType: "placeholder_member",
      targetEntityId: placeholder.id,
      metadata: { displayName },
    });

    res.status(201).json(placeholderToApi(placeholder));
  },
);

router.patch(
  "/circles/:circleId/placeholder-members/:placeholderId",
  requireAuth,
  validateParams(circleIdParam.merge(placeholderIdParam)),
  validateBody(updatePlaceholderSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const placeholderId = parseInt(String(req.params.placeholderId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const isAdminOrOwner = canManageMembers(member.role);
    if (!isAdminOrOwner) {
      res.status(403).json({ error: "Only admins can update placeholder members" });
      return;
    }

    const existing = await db
      .select()
      .from(placeholderMembersTable)
      .where(and(eq(placeholderMembersTable.id, placeholderId), eq(placeholderMembersTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      res.status(404).json({ error: "Placeholder member not found" });
      return;
    }

    const { displayName, relationship, notes, email } = req.body;
    const [updated] = await db
      .update(placeholderMembersTable)
      .set({
        ...(displayName !== undefined && { displayName }),
        ...(relationship !== undefined && { relationship }),
        ...(notes !== undefined && { notes }),
        ...(email !== undefined && { email }),
      })
      .where(eq(placeholderMembersTable.id, placeholderId))
      .returning();

    res.json(placeholderToApi(updated));
  },
);

router.delete(
  "/circles/:circleId/placeholder-members/:placeholderId",
  requireAuth,
  validateParams(circleIdParam.merge(placeholderIdParam)),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const placeholderId = parseInt(String(req.params.placeholderId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const isAdminOrOwner = canManageMembers(member.role);
    if (!isAdminOrOwner) {
      res.status(403).json({ error: "Only admins can remove placeholder members" });
      return;
    }

    const existing = await db
      .select()
      .from(placeholderMembersTable)
      .where(and(eq(placeholderMembersTable.id, placeholderId), eq(placeholderMembersTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      res.status(404).json({ error: "Placeholder member not found" });
      return;
    }

    await db.delete(placeholderMembersTable).where(eq(placeholderMembersTable.id, placeholderId));
    res.status(204).send();
  },
);

router.post(
  "/circles/:circleId/placeholder-members/:placeholderId/claim",
  requireAuth,
  validateParams(circleIdParam.merge(placeholderIdParam)),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const placeholderId = parseInt(String(req.params.placeholderId));

    const placeholder = await db
      .select()
      .from(placeholderMembersTable)
      .where(and(eq(placeholderMembersTable.id, placeholderId), eq(placeholderMembersTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0]);

    if (!placeholder) {
      res.status(404).json({ error: "Placeholder member not found" });
      return;
    }

    if (placeholder.status === "claimed") {
      res.status(409).json({ error: "This placeholder has already been claimed" });
      return;
    }

    const existingMembership = await db
      .select()
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.userId, userId),
          eq(circleMembersTable.status, "active"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!existingMembership) {
      const claimantUser = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1)
        .then((r) => r[0] ?? null);

      const emailMatches =
        placeholder.email &&
        claimantUser?.email &&
        placeholder.email.toLowerCase() === claimantUser.email.toLowerCase();

      if (!emailMatches) {
        res.status(403).json({ error: "You must be a circle member or match the placeholder email to claim" });
        return;
      }

      await db.insert(circleMembersTable).values({
        circleId,
        userId,
        role: "member",
        status: "active",
        joinedAt: new Date(),
        showOnProfile: req.dbUser!.profileShowCirclesDefault !== false,
      });
    }

    const [updated] = await db
      .update(placeholderMembersTable)
      .set({ status: "claimed", claimedByUserId: userId, claimedAt: new Date() })
      .where(eq(placeholderMembersTable.id, placeholderId))
      .returning();

    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: "placeholder_member_claimed",
      targetEntityType: "placeholder_member",
      targetEntityId: placeholderId,
      metadata: { claimedByUserId: userId },
    });

    res.json(placeholderToApi(updated));
  },
);

export default router;
