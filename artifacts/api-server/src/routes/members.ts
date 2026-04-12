import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, circleIdParam, memberIdParam, circleAndMemberIdParam, invitationIdParam, invitationTokenParam } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  circleMembersTable,
  circlesTable,
  circleInvitationsTable,
  usersTable,
  type CircleMember,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { addDays } from "date-fns";
import { createAuditLog, createNotification } from "../lib/helpers";

const router = Router();

const createInvitationSchema = z.object({
  invitedEmail: z.string().email().optional(),
  role: z.enum(["member", "admin", "guest"]).optional().default("member"),
  customMessage: z.string().max(1000).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional().default(7),
});

const updateMemberSchema = z.object({
  role: z.enum(["member", "admin", "guest"]),
});

function memberToApi(
  member: CircleMember,
  user: { displayName: string; email: string } | null,
) {
  return {
    id: member.id,
    circleId: member.circleId,
    userId: member.userId,
    displayName: user?.displayName ?? "Unknown",
    email: user?.email ?? null,
    role: member.role,
    status: member.status,
    joinedAt: member.joinedAt,
    createdAt: member.createdAt,
  };
}

router.get("/circles/:circleId/members", requireAuth, validateParams(circleIdParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const myMembership = await db
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
    .then((r) => r[0]);

  if (!myMembership) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const members = await db
    .select({
      member: circleMembersTable,
      user: usersTable,
    })
    .from(circleMembersTable)
    .leftJoin(usersTable, eq(circleMembersTable.userId, usersTable.id))
    .where(
      and(
        eq(circleMembersTable.circleId, circleId),
        eq(circleMembersTable.status, "active"),
      ),
    );

  res.json(
    members.map((row) =>
      memberToApi(row.member, row.user ? { displayName: row.user.displayName, email: row.user.email } : null),
    ),
  );
});

router.patch(
  "/circles/:circleId/members/:memberId",
  requireAuth,
  validateParams(circleAndMemberIdParam),
  validateBody(updateMemberSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const memberId = parseInt(String(req.params.memberId));

    const myMembership = await db
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
      .then((r) => r[0]);

    const circle = await db
      .select()
      .from(circlesTable)
      .where(eq(circlesTable.id, circleId))
      .limit(1)
      .then((r) => r[0]);

    if (!myMembership || !circle) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    if (circle.ownerId !== userId && myMembership.role !== "admin") {
      res.status(403).json({ error: "Only owners and admins can update member roles" });
      return;
    }

    const { role } = req.body;

    const targetMember = await db
      .select()
      .from(circleMembersTable)
      .where(and(eq(circleMembersTable.id, memberId), eq(circleMembersTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0]);

    if (!targetMember) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (targetMember.role === "owner") {
      res.status(403).json({ error: "The circle owner's role cannot be changed" });
      return;
    }

    const [updated] = await db
      .update(circleMembersTable)
      .set({ ...(role !== undefined && { role }) })
      .where(and(eq(circleMembersTable.id, memberId), eq(circleMembersTable.circleId, circleId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, updated.userId!))
      .limit(1)
      .then((r) => r[0] ?? null);

    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: "member_role_changed",
      targetEntityType: "circle_member",
      targetEntityId: updated.id,
      metadata: { newRole: role, targetUserId: updated.userId },
    });

    if (updated.userId && updated.userId !== userId) {
      await createNotification({
        userId: updated.userId,
        circleId,
        notificationType: "circle_update",
        title: "Your circle role was updated",
        body: `Your role has been changed to ${role}.`,
        targetEntityType: "circle_member",
        targetEntityId: updated.id,
      });
    }

    res.json(memberToApi(updated, user ? { displayName: user.displayName, email: user.email } : null));
  },
);

router.delete(
  "/circles/:circleId/members/:memberId",
  requireAuth,
  validateParams(circleAndMemberIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const memberId = parseInt(String(req.params.memberId));

    const circle = await db
      .select()
      .from(circlesTable)
      .where(eq(circlesTable.id, circleId))
      .limit(1)
      .then((r) => r[0]);

    const myMembership = await db
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
      .then((r) => r[0]);

    if (!myMembership || !circle) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const target = await db
      .select()
      .from(circleMembersTable)
      .where(and(eq(circleMembersTable.id, memberId), eq(circleMembersTable.circleId, circleId)))
      .limit(1)
      .then((r) => r[0]);

    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (target.role === "owner") {
      res.status(403).json({ error: "The circle owner cannot be removed" });
      return;
    }

    if (
      circle.ownerId !== userId &&
      myMembership.role !== "admin" &&
      target.userId !== userId
    ) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db
      .update(circleMembersTable)
      .set({ status: "removed" })
      .where(and(eq(circleMembersTable.id, memberId), eq(circleMembersTable.circleId, circleId)));

    res.status(204).end();
  },
);

router.get("/circles/:circleId/invitations", requireAuth, validateParams(circleIdParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const myMembership = await db
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
    .then((r) => r[0]);

  if (!myMembership) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  if (!["owner", "admin"].includes(myMembership.role)) {
    res.status(403).json({ error: "Only circle admins can view pending invitations" });
    return;
  }

  const invitations = await db
    .select()
    .from(circleInvitationsTable)
    .where(
      and(
        eq(circleInvitationsTable.circleId, circleId),
        eq(circleInvitationsTable.status, "pending"),
      ),
    );

  res.json(invitations);
});

router.post("/circles/:circleId/invitations", requireAuth, validateParams(circleIdParam), validateBody(createInvitationSchema), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const myMembership = await db
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
    .then((r) => r[0]);

  if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
    res.status(403).json({ error: "Only circle owners and admins can send invitations" });
    return;
  }

  const { invitedEmail, role = "member", customMessage, expiresInDays = 7 } = req.body;

  const token = randomBytes(24).toString("hex");
  const expiresAt = addDays(new Date(), expiresInDays);

  const [invitation] = await db
    .insert(circleInvitationsTable)
    .values({
      circleId,
      invitedEmail,
      invitedByUserId: userId,
      role,
      customMessage,
      status: "pending",
      token,
      expiresAt,
    })
    .returning();

  res.status(201).json({
    ...invitation,
    inviteLink: `/invite/${invitation.token}`,
  });
});

router.post("/invitations/:token/accept", requireAuth, validateParams(invitationTokenParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const token = String(req.params.token);

  const invitation = await db
    .select()
    .from(circleInvitationsTable)
    .where(eq(circleInvitationsTable.token, token))
    .limit(1)
    .then((r) => r[0]);

  if (!invitation || invitation.status !== "pending") {
    res.status(404).json({ error: "Invitation not found or already used" });
    return;
  }

  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    await db
      .update(circleInvitationsTable)
      .set({ status: "expired" })
      .where(eq(circleInvitationsTable.id, invitation.id));
    res.status(404).json({ error: "Invitation has expired" });
    return;
  }

  if (
    invitation.invitedEmail &&
    invitation.invitedEmail.toLowerCase() !== req.dbUser!.email.toLowerCase()
  ) {
    res.status(403).json({ error: "This invitation was sent to a different email address" });
    return;
  }

  const user = req.dbUser!;
  const now = new Date();

  const member = await db.transaction(async (tx) => {
    const existingMembership = await tx
      .select()
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, invitation.circleId),
          eq(circleMembersTable.userId, userId),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    await tx
      .update(circleInvitationsTable)
      .set({ status: "accepted", acceptedAt: now })
      .where(eq(circleInvitationsTable.id, invitation.id));

    if (existingMembership) {
      if (existingMembership.status === "active") {
        return existingMembership;
      }
      const [reactivated] = await tx
        .update(circleMembersTable)
        .set({ status: "active", role: invitation.role, joinedAt: now, updatedAt: now })
        .where(eq(circleMembersTable.id, existingMembership.id))
        .returning();
      return reactivated;
    }

    const [inserted] = await tx
      .insert(circleMembersTable)
      .values({
        circleId: invitation.circleId,
        userId,
        role: invitation.role,
        status: "active",
        joinedAt: now,
      })
      .returning();
    return inserted;
  });

  const joinerName = user.displayName;
  const circleMembers = await db
    .select({ userId: circleMembersTable.userId })
    .from(circleMembersTable)
    .where(and(eq(circleMembersTable.circleId, invitation.circleId), eq(circleMembersTable.status, "active")))
    .then((rows) => rows.filter((r) => r.userId !== null && r.userId !== userId)) as { userId: number }[];

  for (const cm of circleMembers) {
    await createNotification({
      userId: cm.userId,
      circleId: invitation.circleId,
      notificationType: "member_joined",
      title: "A new member joined your circle",
      body: `${joinerName} has joined your circle.`,
      targetEntityType: "circle",
      targetEntityId: invitation.circleId,
    });
  }

  await createAuditLog({
    circleId: invitation.circleId,
    actorUserId: userId,
    action: "member_joined",
    targetEntityType: "circle",
    targetEntityId: invitation.circleId,
    metadata: { role: invitation.role },
  });

  res.json(memberToApi(member, { displayName: user.displayName, email: user.email }));
});

router.delete("/invitations/:invitationId", requireAuth, validateParams(invitationIdParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const invitationId = parseInt(String(req.params.invitationId));

  const invitation = await db
    .select()
    .from(circleInvitationsTable)
    .where(eq(circleInvitationsTable.id, invitationId))
    .limit(1)
    .then((r) => r[0]);

  if (!invitation) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  const myMembership = await db
    .select()
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, invitation.circleId),
        eq(circleMembersTable.userId, userId),
        eq(circleMembersTable.status, "active"),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (
    !myMembership ||
    (!["owner", "admin"].includes(myMembership.role) &&
      invitation.invitedByUserId !== userId)
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .update(circleInvitationsTable)
    .set({ status: "revoked" })
    .where(eq(circleInvitationsTable.id, invitationId));

  res.status(204).end();
});

const transferOwnershipSchema = z.object({
  newOwnerUserId: z.number().int().positive(),
});

router.post(
  "/circles/:circleId/transfer-ownership",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(transferOwnershipSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const { newOwnerUserId } = req.body;

    const currentOwner = await db
      .select()
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.userId, userId),
          eq(circleMembersTable.status, "active"),
          eq(circleMembersTable.role, "owner"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!currentOwner) {
      res.status(403).json({ error: "Only the current circle owner can transfer ownership" });
      return;
    }

    if (newOwnerUserId === userId) {
      res.status(400).json({ error: "Cannot transfer ownership to yourself" });
      return;
    }

    const newOwnerMember = await db
      .select()
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.userId, newOwnerUserId),
          eq(circleMembersTable.status, "active"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!newOwnerMember) {
      res.status(404).json({ error: "New owner must be an active member of this circle" });
      return;
    }

    const demoted = await db.transaction(async (tx) => {
      await tx
        .update(circlesTable)
        .set({ ownerId: newOwnerUserId })
        .where(eq(circlesTable.id, circleId));

      await tx
        .update(circleMembersTable)
        .set({ role: "owner" })
        .where(eq(circleMembersTable.id, newOwnerMember.id));

      const [demotedMember] = await tx
        .update(circleMembersTable)
        .set({ role: "admin" })
        .where(eq(circleMembersTable.id, currentOwner.id))
        .returning();

      return demotedMember;
    });

    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: "ownership_transferred",
      targetEntityType: "user",
      targetEntityId: newOwnerUserId,
      metadata: { previousOwnerId: userId, newOwnerId: newOwnerUserId },
    });

    await createNotification({
      userId: newOwnerUserId,
      circleId,
      notificationType: "system",
      title: "You are now the circle owner",
      body: `${req.dbUser!.displayName} transferred ownership of the circle to you.`,
      targetEntityType: "circle",
      targetEntityId: circleId,
    });

    const ownerUser = await db
      .select({ displayName: usersTable.displayName, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then((r) => r[0] ?? null);

    res.json(memberToApi(demoted, ownerUser));
  },
);

export default router;
