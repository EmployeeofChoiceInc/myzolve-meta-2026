import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
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

const router = Router();

const createInvitationSchema = z.object({
  invitedEmail: z.string().email().optional(),
  role: z.enum(["member", "admin"]).optional().default("member"),
  customMessage: z.string().max(1000).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional().default(7),
});

const updateMemberSchema = z.object({
  role: z.enum(["member", "admin"]),
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

router.get("/circles/:circleId/members", requireAuth, async (req, res) => {
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

    res.json(memberToApi(updated, user ? { displayName: user.displayName, email: user.email } : null));
  },
);

router.delete(
  "/circles/:circleId/members/:memberId",
  requireAuth,
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

router.get("/circles/:circleId/invitations", requireAuth, async (req, res) => {
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

router.post("/circles/:circleId/invitations", requireAuth, validateBody(createInvitationSchema), async (req, res) => {
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

  const { invitedEmail, role = "member", customMessage } = req.body;

  if (!invitedEmail) {
    res.status(400).json({ error: "invitedEmail is required" });
    return;
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = addDays(new Date(), 7);

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

  res.status(201).json(invitation);
});

router.post("/invitations/:token/accept", requireAuth, async (req, res) => {
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

  await db
    .update(circleInvitationsTable)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(circleInvitationsTable.id, invitation.id));

  const [member] = await db
    .insert(circleMembersTable)
    .values({
      circleId: invitation.circleId,
      userId,
      role: invitation.role,
      status: "active",
      joinedAt: new Date(),
    })
    .returning();

  const user = req.dbUser!;
  res.json(memberToApi(member, { displayName: user.displayName, email: user.email }));
});

router.delete("/invitations/:invitationId", requireAuth, async (req, res) => {
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

export default router;
