import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, circleIdParam, memberIdParam, circleAndMemberIdParam, invitationIdParam, invitationTokenParam, joinRequestIdParam } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  circleMembersTable,
  circlesTable,
  circleInvitationsTable,
  circleJoinRequestsTable,
  usersTable,
  type CircleMember,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { addDays } from "date-fns";
import { createAuditLog, createNotification } from "../lib/helpers";
import {
  canManageMembers,
  isOwnerOrAdmin,
  isPlusGatedRole,
  ASSIGNABLE_ROLES,
} from "../lib/permissions";
import { isPlus } from "../lib/revenuecat";
import { assertCanJoinAnotherCircle } from "../lib/circleLimits";

const router = Router();

const createInvitationSchema = z.object({
  invitedEmail: z.string().email().optional(),
  role: z
    .enum(["member", "guest", "admin", "host", "treasurer", "scribe"])
    .optional()
    .default("member"),
  customMessage: z.string().max(1000).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional().default(7),
});

const updateMemberSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES),
});

function memberToApi(
  member: CircleMember,
  user: { displayName: string; email: string; avatarObjectPath: string | null } | null,
) {
  return {
    id: member.id,
    circleId: member.circleId,
    userId: member.userId,
    displayName: user?.displayName ?? "Unknown",
    email: user?.email ?? null,
    avatarObjectPath: user?.avatarObjectPath ?? null,
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
      memberToApi(
        row.member,
        row.user
          ? {
              displayName: row.user.displayName,
              email: row.user.email,
              avatarObjectPath: row.user.avatarObjectPath ?? null,
            }
          : null,
      ),
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

    // Only the circle owner can change roles. Sub-roles (host/treasurer/
    // scribe) are part of Plus, so the host role itself does NOT grant the
    // ability to delegate further.
    if (circle.ownerId !== userId) {
      res.status(403).json({ error: "Only the circle owner can update member roles" });
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

    // Granting a Plus sub-role requires the granting owner to have an active
    // Plus entitlement. Demoting back to member/guest is always allowed so a
    // circle is never left in a stranded state if the owner downgrades.
    if (isPlusGatedRole(role)) {
      const ownerHasPlus = await isPlus(req.dbUser!.clerkId);
      if (!ownerHasPlus) {
        res.status(402).json({
          error: "plus_required",
          reason: "role_grant",
          message:
            "Granting host, treasurer, or scribe roles is part of MyZolve Connect Plus.",
        });
        return;
      }
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

    res.json(memberToApi(updated, user ? { displayName: user.displayName, email: user.email, avatarObjectPath: user.avatarObjectPath ?? null } : null));
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
      !canManageMembers(myMembership.role) &&
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

  if (!canManageMembers(myMembership.role)) {
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

  if (!myMembership || !canManageMembers(myMembership.role)) {
    res.status(403).json({ error: "Only circle owners and admins can send invitations" });
    return;
  }

  const { invitedEmail, role = "member", customMessage, expiresInDays = 7 } = req.body;

  // Inviting someone directly into a Plus sub-role (host / treasurer /
  // scribe) is an owner-only delegation. Hosts have invite power for
  // member/guest, but cannot indirectly hand out privileged sub-roles.
  // The Plus entitlement is checked against the circle owner so the
  // inviter's own subscription state cannot bypass the gate.
  if (isPlusGatedRole(role)) {
    const circle = await db
      .select()
      .from(circlesTable)
      .where(eq(circlesTable.id, circleId))
      .limit(1)
      .then((r) => r[0]);
    if (!circle) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }
    if (circle.ownerId !== userId) {
      res.status(403).json({
        error: "Only the circle owner can invite host, treasurer, or scribe",
      });
      return;
    }
    const owner = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, circle.ownerId))
      .limit(1)
      .then((r) => r[0]);
    const ownerHasPlus = owner ? await isPlus(owner.clerkId) : false;
    if (!ownerHasPlus) {
      res.status(402).json({
        error: "plus_required",
        reason: "role_grant",
        message:
          "Inviting someone as host, treasurer, or scribe is part of MyZolve Connect Plus.",
      });
      return;
    }
  }

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

// Lightweight preview for the invite-accept screen so the invitee can
// see who's inviting them, the circle's name and verified status BEFORE
// they tap accept. The token itself is the access secret.
router.get(
  "/invitations/:token",
  requireAuth,
  validateParams(invitationTokenParam),
  async (req, res) => {
    const token = String(req.params.token);

    const row = await db
      .select({
        invitation: circleInvitationsTable,
        circle: circlesTable,
        invitedBy: usersTable,
      })
      .from(circleInvitationsTable)
      .innerJoin(
        circlesTable,
        eq(circleInvitationsTable.circleId, circlesTable.id),
      )
      .leftJoin(
        usersTable,
        eq(circleInvitationsTable.invitedByUserId, usersTable.id),
      )
      .where(eq(circleInvitationsTable.token, token))
      .limit(1)
      .then((r) => r[0]);

    if (!row) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }

    const status =
      row.invitation.status === "pending" &&
      row.invitation.expiresAt &&
      row.invitation.expiresAt < new Date()
        ? "expired"
        : row.invitation.status;

    res.json({
      token: row.invitation.token,
      status,
      role: row.invitation.role,
      invitedEmail: row.invitation.invitedEmail ?? null,
      expiresAt: row.invitation.expiresAt
        ? row.invitation.expiresAt.toISOString()
        : null,
      circle: {
        id: row.circle.id,
        name: row.circle.name,
        circleType: row.circle.circleType,
        description: row.circle.description ?? null,
        photoUrl: row.circle.photoUrl ?? null,
        verificationStatus: row.circle.verificationStatus ?? "none",
      },
      invitedBy: {
        displayName: row.invitedBy?.displayName ?? "Someone",
      },
    });
  },
);

router.post("/invitations/:token/accept", requireAuth, validateParams(invitationTokenParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const clerkId = req.dbUser!.clerkId;
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

  // Existing memberships are not affected — only block joining a NEW circle
  // that would push past the free cap.
  const existingMembershipQuick = await db
    .select({ id: circleMembersTable.id, status: circleMembersTable.status })
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, invitation.circleId),
        eq(circleMembersTable.userId, userId),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  const wouldBeNewMembership =
    !existingMembershipQuick || existingMembershipQuick.status !== "active";

  if (wouldBeNewMembership) {
    const cap = await assertCanJoinAnotherCircle({ userId, clerkId });
    if (cap) {
      res.status(402).json(cap);
      return;
    }
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

  res.json(memberToApi(member, { displayName: user.displayName, email: user.email, avatarObjectPath: user.avatarObjectPath ?? null }));
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
    (!canManageMembers(myMembership.role) &&
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
      .select({ displayName: usersTable.displayName, email: usersTable.email, avatarObjectPath: usersTable.avatarObjectPath })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then((r) => r[0] ?? null);

    res.json(memberToApi(demoted, ownerUser ? { ...ownerUser, avatarObjectPath: ownerUser.avatarObjectPath ?? null } : null));
  },
);

router.get(
  "/circles/:circleId/join-requests",
  requireAuth,
  validateParams(circleIdParam),
  async (req, res) => {
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

    if (!myMembership || !canManageMembers(myMembership.role)) {
      res.status(403).json({ error: "Only circle admins can view join requests" });
      return;
    }

    const requests = await db
      .select({
        request: circleJoinRequestsTable,
        requesterName: usersTable.displayName,
        requesterEmail: usersTable.email,
      })
      .from(circleJoinRequestsTable)
      .leftJoin(usersTable, eq(circleJoinRequestsTable.userId, usersTable.id))
      .where(
        and(
          eq(circleJoinRequestsTable.circleId, circleId),
          eq(circleJoinRequestsTable.status, "pending"),
        ),
      );

    res.json(
      requests.map(({ request, requesterName, requesterEmail }) => ({
        id: request.id,
        circleId: request.circleId,
        userId: request.userId,
        requesterName: requesterName ?? "Unknown",
        requesterEmail: requesterEmail ?? null,
        note: request.note,
        status: request.status,
        createdAt: request.createdAt,
      })),
    );
  },
);

router.post(
  "/circles/:circleId/join-requests/:requestId/approve",
  requireAuth,
  validateParams(joinRequestIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const requestId = parseInt(String(req.params.requestId));

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

    if (!myMembership || !canManageMembers(myMembership.role)) {
      res.status(403).json({ error: "Only circle admins can approve join requests" });
      return;
    }

    const joinRequest = await db
      .select()
      .from(circleJoinRequestsTable)
      .where(
        and(
          eq(circleJoinRequestsTable.id, requestId),
          eq(circleJoinRequestsTable.circleId, circleId),
          eq(circleJoinRequestsTable.status, "pending"),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!joinRequest) {
      res.status(404).json({ error: "Join request not found or already resolved" });
      return;
    }

    // Cap applies to the requester (the person being added), not the
    // approver. We resolve the requester's clerkId for the Plus check.
    const requesterRow = await db
      .select({ id: usersTable.id, clerkId: usersTable.clerkId })
      .from(usersTable)
      .where(eq(usersTable.id, joinRequest.userId))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (requesterRow) {
      const cap = await assertCanJoinAnotherCircle({
        userId: requesterRow.id,
        clerkId: requesterRow.clerkId,
      });
      if (cap) {
        res.status(402).json(cap);
        return;
      }
    }

    const now = new Date();

    const member = await db.transaction(async (tx) => {
      await tx
        .update(circleJoinRequestsTable)
        .set({ status: "approved", reviewedByUserId: userId, reviewedAt: now })
        .where(eq(circleJoinRequestsTable.id, requestId));

      const existing = await tx
        .select()
        .from(circleMembersTable)
        .where(
          and(
            eq(circleMembersTable.circleId, circleId),
            eq(circleMembersTable.userId, joinRequest.userId),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      if (existing) {
        if (existing.status === "active") return existing;
        const [reactivated] = await tx
          .update(circleMembersTable)
          .set({ status: "active", role: "member", joinedAt: now, updatedAt: now })
          .where(eq(circleMembersTable.id, existing.id))
          .returning();
        return reactivated;
      }

      const [inserted] = await tx
        .insert(circleMembersTable)
        .values({
          circleId,
          userId: joinRequest.userId,
          role: "member",
          status: "active",
          joinedAt: now,
        })
        .returning();
      return inserted;
    });

    const circle = await db
      .select({ name: circlesTable.name })
      .from(circlesTable)
      .where(eq(circlesTable.id, circleId))
      .limit(1)
      .then((r) => r[0]);

    await createNotification({
      userId: joinRequest.userId,
      circleId,
      notificationType: "join_request",
      title: "Your request was approved",
      body: `You have been approved to join ${circle?.name ?? "the circle"}.`,
      targetEntityType: "circle",
      targetEntityId: circleId,
    });

    await createAuditLog({
      circleId,
      actorUserId: userId,
      action: "join_request_approved",
      targetEntityType: "circle_join_request",
      targetEntityId: requestId,
      metadata: { approvedUserId: joinRequest.userId },
    });

    const requesterUser = await db
      .select({
        displayName: usersTable.displayName,
        email: usersTable.email,
        avatarObjectPath: usersTable.avatarObjectPath,
      })
      .from(usersTable)
      .where(eq(usersTable.id, joinRequest.userId))
      .limit(1)
      .then((r) => r[0] ?? null);

    res.json(
      memberToApi(
        member,
        requesterUser
          ? { ...requesterUser, avatarObjectPath: requesterUser.avatarObjectPath ?? null }
          : null,
      ),
    );
  },
);

router.post(
  "/circles/:circleId/join-requests/:requestId/decline",
  requireAuth,
  validateParams(joinRequestIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const requestId = parseInt(String(req.params.requestId));

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

    if (!myMembership || !canManageMembers(myMembership.role)) {
      res.status(403).json({ error: "Only circle admins can decline join requests" });
      return;
    }

    const joinRequest = await db
      .select()
      .from(circleJoinRequestsTable)
      .where(
        and(
          eq(circleJoinRequestsTable.id, requestId),
          eq(circleJoinRequestsTable.circleId, circleId),
          eq(circleJoinRequestsTable.status, "pending"),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!joinRequest) {
      res.status(404).json({ error: "Join request not found or already resolved" });
      return;
    }

    const now = new Date();

    await db
      .update(circleJoinRequestsTable)
      .set({ status: "declined", reviewedByUserId: userId, reviewedAt: now })
      .where(eq(circleJoinRequestsTable.id, requestId));

    const circle = await db
      .select({ name: circlesTable.name })
      .from(circlesTable)
      .where(eq(circlesTable.id, circleId))
      .limit(1)
      .then((r) => r[0]);

    await createNotification({
      userId: joinRequest.userId,
      circleId,
      notificationType: "join_request",
      title: "Your join request was not approved",
      body: `Your request to join ${circle?.name ?? "the circle"} was not approved at this time.`,
      targetEntityType: "circle_join_request",
      targetEntityId: requestId,
    });

    res.status(204).end();
  },
);

export default router;
