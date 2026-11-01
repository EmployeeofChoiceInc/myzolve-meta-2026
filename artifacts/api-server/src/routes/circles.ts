import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams, circleIdParam } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  circlesTable,
  circleMembersTable,
  circleJoinRequestsTable,
  placeholderMembersTable,
  usersTable,
  type Circle,
} from "@workspace/db";
import { eq, and, count, sql, isNull } from "drizzle-orm";
import { createAuditLog } from "../lib/helpers";
import { isOwnerOrAdmin, canManageLedger } from "../lib/permissions";
import { assertCanJoinAnotherCircle } from "../lib/circleLimits";
import { isPlus } from "../lib/revenuecat";
import { isAllowedAccentColor, MAX_WELCOME_MESSAGE_LEN } from "../lib/circleLook";
import { getOrgBrandingMap } from "../lib/orgEntitlement";
import { validateAndConsumePendingUpload } from "../lib/uploadTokens";
import { withMemberCapacity } from "../lib/continuityPacket";
import {
  activeContinuityPacketNotes,
  addUnlinkedCirclePlaceholders,
  canDownloadCircleContinuityPacket,
} from "../lib/continuityPacketRules";
import { GetCircleContinuityPacketResponse } from "@workspace/api-zod";
import {
  supportRequestsTable,
  servicePostsTable,
  activityFeedItemsTable,
  supportContributionsTable,
  circlePostsTable,
} from "@workspace/db";
import { createNotification } from "../lib/helpers";
import { desc } from "drizzle-orm";

/**
 * Returns true if the requesting user's email matches the configured
 * verification admin allow-list. The MyZolve team uses a small static
 * allow-list (comma-separated `VERIFICATION_ADMIN_EMAIL` env var) for
 * the verified-circle queue rather than a full RBAC system.
 */
function isVerificationAdmin(email: string | null | undefined): boolean {
  const raw = process.env["VERIFICATION_ADMIN_EMAIL"];
  if (!raw || !email) return false;
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

const router = Router();

const createCircleSchema = z.object({
  name: z.string().min(1).max(100),
  circleType: z.enum(["family", "chosen_family", "friends", "caregiving_circle", "neighborhood_circle", "other"]).optional().default("family"),
  description: z.string().max(1000).optional(),
  currency: z.string().length(3).optional().default("USD"),
  privacyMode: z.enum(["private", "hidden", "open", "community"]).optional().default("private"),
  ledgerMode: z.enum(["private", "summary", "full", "admin_only"]).optional().default("private"),
});

const updateCircleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  circleType: z.enum(["family", "chosen_family", "friends", "caregiving_circle", "neighborhood_circle", "other"]).optional(),
  description: z.string().max(1000).optional(),
  currency: z.string().length(3).optional(),
  privacyMode: z.enum(["private", "hidden", "open", "community"]).optional(),
  ledgerMode: z.enum(["private", "summary", "full", "admin_only"]).optional(),
  // Plus customization. `null` clears the value; any non-null value
  // requires Plus on the owner (server-enforced below).
  bannerObjectPath: z.string().max(1000).nullable().optional(),
  accentColor: z.string().max(16).nullable().optional(),
  welcomeMessage: z.string().max(MAX_WELCOME_MESSAGE_LEN).nullable().optional(),
});

type OrgBranding = {
  name: string;
  logoObjectPath: string | null;
  accentColor: string | null;
};

function circleToApi(
  circle: Circle,
  memberCount: number,
  myRole: string | null,
  showWelcomeCard = false,
  orgBranding?: OrgBranding | null,
) {
  return {
    id: circle.id,
    name: circle.name,
    circleType: circle.circleType,
    description: circle.description,
    photoUrl: circle.photoUrl,
    currency: circle.currency,
    privacyMode: circle.privacyMode,
    ledgerMode: circle.ledgerMode,
    ownerId: circle.ownerId,
    memberCount,
    myRole,
    bannerObjectPath: circle.bannerObjectPath,
    accentColor: circle.accentColor,
    welcomeMessage: circle.welcomeMessage,
    showWelcomeCard,
    verificationStatus: circle.verificationStatus ?? "none",
    verificationAppliedAt: circle.verificationAppliedAt ?? null,
    verificationDecisionReason: circle.verificationDecisionReason ?? null,
    orgId: circle.orgId ?? null,
    orgName: orgBranding?.name ?? null,
    orgLogoUrl:
      circle.orgId && orgBranding?.logoObjectPath
        ? `/api/orgs/${circle.orgId}/logo`
        : null,
    orgAccentColor: orgBranding?.accentColor ?? null,
    createdAt: circle.createdAt,
    isOrgMain: circle.isOrgMain,
  };
}

async function brandingForCircle(
  circle: Circle,
): Promise<OrgBranding | null> {
  if (!circle.orgId) return null;
  const map = await getOrgBrandingMap([circle.orgId]);
  return map.get(circle.orgId) ?? null;
}

const createJoinRequestSchema = z.object({
  note: z.string().max(500).optional(),
});

router.get("/circles/discover", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;

  const openCircles = await db
    .select({
      circle: circlesTable,
      creatorName: usersTable.displayName,
      memberCount: count(circleMembersTable.id),
    })
    .from(circlesTable)
    .leftJoin(usersTable, eq(circlesTable.ownerId, usersTable.id))
    .leftJoin(
      circleMembersTable,
      and(
        eq(circleMembersTable.circleId, circlesTable.id),
        eq(circleMembersTable.status, "active"),
      ),
    )
    .where(sql`${circlesTable.privacyMode} IN ('open', 'community')`)
    .groupBy(circlesTable.id, usersTable.displayName);

  const circleIds = openCircles.map((c) => c.circle.id);

  const [myMemberships, myJoinRequests] = await Promise.all([
    circleIds.length > 0
      ? db
          .select({ circleId: circleMembersTable.circleId })
          .from(circleMembersTable)
          .where(
            and(
              eq(circleMembersTable.userId, userId),
              eq(circleMembersTable.status, "active"),
            ),
          )
      : Promise.resolve([]),
    circleIds.length > 0
      ? db
          .select({ circleId: circleJoinRequestsTable.circleId, status: circleJoinRequestsTable.status })
          .from(circleJoinRequestsTable)
          .where(eq(circleJoinRequestsTable.userId, userId))
      : Promise.resolve([]),
  ]);

  const memberSet = new Set(myMemberships.map((m) => m.circleId));
  const joinRequestMap = new Map(myJoinRequests.map((r) => [r.circleId, r.status]));

  res.json(
    openCircles.map(({ circle, creatorName, memberCount }) => ({
      id: circle.id,
      name: circle.name,
      circleType: circle.circleType,
      description: circle.description,
      currency: circle.currency,
      privacyMode: circle.privacyMode,
      ownerId: circle.ownerId,
      creatorName: creatorName ?? "Unknown",
      memberCount: Number(memberCount),
      isMember: memberSet.has(circle.id),
      joinRequestStatus: joinRequestMap.get(circle.id) ?? null,
      verificationStatus: circle.verificationStatus ?? "none",
      createdAt: circle.createdAt,
    })),
  );
});

router.post(
  "/circles/:circleId/join-request",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(createJoinRequestSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const { note } = req.body;

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

    if (!["open", "community"].includes(circle.privacyMode)) {
      res.status(403).json({ error: "This circle does not accept join requests" });
      return;
    }

    const existing = await db
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

    if (existing) {
      res.status(409).json({ error: "You are already a member of this circle" });
      return;
    }

    const cap = await assertCanJoinAnotherCircle({
      userId,
      clerkId: req.dbUser!.clerkId,
    });
    if (cap) {
      res.status(402).json(cap);
      return;
    }

    const existingRequest = await db
      .select()
      .from(circleJoinRequestsTable)
      .where(
        and(
          eq(circleJoinRequestsTable.circleId, circleId),
          eq(circleJoinRequestsTable.userId, userId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (existingRequest) {
      if (existingRequest.status === "pending") {
        res.status(409).json({ error: "You already have a pending join request for this circle" });
        return;
      }
      const [updated] = await db
        .update(circleJoinRequestsTable)
        .set({ status: "pending", note: note ?? null, reviewedByUserId: null, reviewedAt: null })
        .where(eq(circleJoinRequestsTable.id, existingRequest.id))
        .returning();
      res.status(201).json(updated);
      return;
    }

    const [joinRequest] = await db
      .insert(circleJoinRequestsTable)
      .values({ circleId, userId, note: note ?? null, status: "pending" })
      .returning();

    const owner = await db
      .select({ userId: circleMembersTable.userId })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.status, "active"),
        ),
      )
      .then((rows) => rows.filter((r) => r.userId !== null)) as { userId: number }[];

    const { createNotification } = await import("../lib/helpers");
    const requesterName = req.dbUser!.displayName;
    for (const m of owner) {
      await createNotification({
        userId: m.userId,
        circleId,
        notificationType: "join_request",
        title: "Someone wants to join your circle",
        body: `${requesterName} has requested to join ${circle.name}.`,
        targetEntityType: "circle_join_request",
        targetEntityId: joinRequest.id,
      });
    }

    res.status(201).json(joinRequest);
  },
);

router.get("/circles", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;

  const memberships = await db
    .select({
      circle: circlesTable,
      role: circleMembersTable.role,
    })
    .from(circleMembersTable)
    .innerJoin(circlesTable, eq(circleMembersTable.circleId, circlesTable.id))
    .where(
      and(
        eq(circleMembersTable.userId, userId),
        eq(circleMembersTable.status, "active"),
      ),
    );

  const circleIds = memberships.map((m) => m.circle.id);

  if (circleIds.length === 0) {
    res.json([]);
    return;
  }

  const memberCounts = await db
    .select({
      circleId: circleMembersTable.circleId,
      cnt: count(),
    })
    .from(circleMembersTable)
    .where(eq(circleMembersTable.status, "active"))
    .groupBy(circleMembersTable.circleId);

  const countMap = new Map(memberCounts.map((mc) => [mc.circleId, Number(mc.cnt)]));

  const brandingMap = await getOrgBrandingMap(
    memberships.map((m) => m.circle.orgId).filter((id): id is number => id != null),
  );

  const result = memberships.map((m) => {
    const mc = countMap.get(m.circle.id) ?? 1;
    let role = m.role;
    if (m.circle.ownerId === userId) role = "owner";
    const branding = m.circle.orgId ? brandingMap.get(m.circle.orgId) ?? null : null;
    return circleToApi(m.circle, mc, role, false, branding);
  });

  res.json(result);
});

router.post("/circles", requireAuth, validateBody(createCircleSchema), async (req, res) => {
  const userId = req.dbUser!.id;
  const clerkId = req.dbUser!.clerkId;

  const cap = await assertCanJoinAnotherCircle({ userId, clerkId });
  if (cap) {
    res.status(402).json(cap);
    return;
  }

  const {
    name,
    circleType = "family",
    description,
    currency = "USD",
    privacyMode = "private",
    ledgerMode = "private",
  } = req.body;

  const [circle] = await db
    .insert(circlesTable)
    .values({
      name,
      circleType,
      description,
      currency,
      privacyMode,
      ledgerMode,
      ownerId: userId,
    })
    .returning();

  await db.insert(circleMembersTable).values({
    circleId: circle.id,
    userId,
    role: "owner",
    status: "active",
    joinedAt: new Date(),
    showOnProfile: req.dbUser!.profileShowCirclesDefault !== false,
  });

  res.status(201).json(circleToApi(circle, 1, "owner"));
});

router.get("/circles/:circleId", requireAuth, validateParams(circleIdParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const membership = await db
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

  if (!membership) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const circle = await db
    .select()
    .from(circlesTable)
    .where(eq(circlesTable.id, circleId))
    .limit(1)
    .then((r) => r[0]);

  const [memberCount] = await db
    .select({ cnt: count() })
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, circleId),
        eq(circleMembersTable.status, "active"),
      ),
    );

  const role = circle.ownerId === userId ? "owner" : membership.role;
  // Show the one-time welcome card only when:
  //   1. the circle has a customized welcome message, AND
  //   2. this member has not dismissed it yet, AND
  //   3. the owner currently has Plus (so non-paying lapsed customizations
  //      don't keep popping a card forever).
  let showWelcomeCard = false;
  if (circle.welcomeMessage && !membership.welcomeDismissedAt) {
    const owner = await db
      .select({ clerkId: usersTable.clerkId })
      .from(usersTable)
      .where(eq(usersTable.id, circle.ownerId))
      .limit(1)
      .then((r) => r[0]);
    showWelcomeCard = owner ? await isPlus(owner.clerkId) : false;
  }
  res.json(
    circleToApi(
      circle,
      Number(memberCount.cnt),
      role,
      showWelcomeCard,
      await brandingForCircle(circle),
    ),
  );
});

router.get(
  "/circles/:circleId/continuity-packet",
  requireAuth,
  validateParams(circleIdParam),
  async (req, res): Promise<void> => {
    const userId = req.dbUser!.id;
    const circleId = Number(req.params.circleId);
    const circle = await db
      .select()
      .from(circlesTable)
      .where(eq(circlesTable.id, circleId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!circle) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const membership = await db
      .select({
        role: circleMembersTable.role,
        status: circleMembersTable.status,
      })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.userId, userId),
          eq(circleMembersTable.status, "active"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const access = canDownloadCircleContinuityPacket({
      ownerId: circle.ownerId,
      userId,
      membership,
    });
    if (access !== "owner" && access !== "admin") {
      res.status(access === "forbidden-member" ? 403 : 404).json({
        error:
          access === "forbidden-member"
            ? "Only circle owners and admins can download this packet"
            : "Circle not found",
      });
      return;
    }

    const memberRows = await db
      .select({
        userId: usersTable.id,
        name: usersTable.displayName,
        role: circleMembersTable.role,
        email: usersTable.email,
        phone: usersTable.phone,
        phoneDiscoverable: usersTable.phoneDiscoverable,
        status: circleMembersTable.status,
      })
      .from(circleMembersTable)
      .innerJoin(usersTable, eq(circleMembersTable.userId, usersTable.id))
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.status, "active"),
        ),
      )
      .orderBy(usersTable.displayName);

    const members = await withMemberCapacity(memberRows);
    const placeholders = await db
      .select({
        name: placeholderMembersTable.displayName,
        relationship: placeholderMembersTable.relationship,
        email: placeholderMembersTable.email,
        status: placeholderMembersTable.status,
      })
      .from(placeholderMembersTable)
      .where(
        and(
          eq(placeholderMembersTable.circleId, circleId),
          eq(placeholderMembersTable.status, "unlinked"),
        ),
      )
      .orderBy(placeholderMembersTable.displayName);
    const packetMembers = addUnlinkedCirclePlaceholders(members, placeholders);

    const sharedNotes = await db
      .select({
        title: circlePostsTable.title,
        body: circlePostsTable.body,
        authorName: usersTable.displayName,
        createdAt: circlePostsTable.createdAt,
        status: circlePostsTable.status,
      })
      .from(circlePostsTable)
      .innerJoin(usersTable, eq(circlePostsTable.authorUserId, usersTable.id))
      .where(
        and(
          eq(circlePostsTable.circleId, circleId),
          eq(circlePostsTable.status, "active"),
        ),
      )
      .orderBy(desc(circlePostsTable.createdAt));

    const activeSharedNotes = activeContinuityPacketNotes(sharedNotes);
    const orgBranding = await brandingForCircle(circle);
    const packet = {
      generatedAt: new Date().toISOString(),
      circle: {
        id: circle.id,
        name: circle.name,
        logoUrl:
          circle.photoUrl ??
          (circle.orgId && orgBranding?.logoObjectPath
            ? `/api/orgs/${circle.orgId}/logo`
            : null),
        accentColor: circle.accentColor ?? orgBranding?.accentColor ?? null,
      },
      members: packetMembers,
      meetingLocations: [],
      sharedNotes: activeSharedNotes,
    };

    res.json(GetCircleContinuityPacketResponse.parse(packet));
  },
);

router.post(
  "/circles/:circleId/welcome/dismiss",
  requireAuth,
  validateParams(circleIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));

    const result = await db
      .update(circleMembersTable)
      .set({ welcomeDismissedAt: new Date() })
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.userId, userId),
          eq(circleMembersTable.status, "active"),
          isNull(circleMembersTable.welcomeDismissedAt),
        ),
      )
      .returning({ id: circleMembersTable.id });

    // Idempotent: even if no row was updated (already dismissed or not
    // a member), the client only cares that the card stays gone.
    void result;
    res.status(204).end();
  },
);

const applyVerificationSchema = z.object({
  legalName: z.string().min(1).max(200),
  orgType: z.enum(["faith_group", "mutual_aid", "co_op", "nonprofit", "other"]),
  description: z.string().min(1).max(2000),
  contactEmail: z.string().email().max(320),
  supportingUrl: z.string().url().max(2000).nullable().optional(),
});

router.post(
  "/circles/:circleId/verification",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(applyVerificationSchema),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));

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

    // Only the owner — not admins — can apply on behalf of the circle.
    if (circle.ownerId !== userId) {
      res.status(403).json({
        error: "Only the circle owner can apply for verification.",
      });
      return;
    }

    // Plus is required to apply (keeps the queue manageable). The
    // resulting verified badge is visible to everyone regardless of
    // their Plus status.
    const ownerHasPlus = await isPlus(req.dbUser!.clerkId);
    if (!ownerHasPlus) {
      res.status(402).json({
        error: "plus_required",
        reason: "circle_verification",
        message:
          "MyZolve Connect Plus is required to apply for verification.",
      });
      return;
    }

    const status = circle.verificationStatus ?? "none";
    if (status === "pending" || status === "verified") {
      res.status(409).json({
        error:
          status === "verified"
            ? "This circle is already verified."
            : "An application is already pending review.",
      });
      return;
    }

    const application = req.body as z.infer<typeof applyVerificationSchema>;
    const now = new Date();
    const metadata = {
      legalName: application.legalName.trim(),
      orgType: application.orgType,
      description: application.description.trim(),
      contactEmail: application.contactEmail.trim(),
      supportingUrl:
        application.supportingUrl && application.supportingUrl.length > 0
          ? application.supportingUrl.trim()
          : null,
    };

    const [updated] = await db
      .update(circlesTable)
      .set({
        verificationStatus: "pending",
        verificationAppliedAt: now,
        verificationDecisionReason: null,
        verificationMetadata: JSON.stringify(metadata),
      })
      .where(eq(circlesTable.id, circleId))
      .returning();

    await createAuditLog({
      actorUserId: userId,
      circleId,
      action: "circle_verification_applied",
      targetEntityType: "circle",
      targetEntityId: circleId,
      metadata,
    });

    // Notify the configured admin email so the team knows there's a
    // new application waiting in the queue.
    const adminEmail = process.env["VERIFICATION_ADMIN_EMAIL"];
    if (adminEmail) {
      const { sendEmail } = await import("../lib/email");
      const adminUrl = `${webBaseUrl()}/admin`;
      const rows = [
        `Circle: ${circle.name} (id: ${circle.id})`,
        `Owner: ${req.dbUser!.displayName} <${req.dbUser!.email ?? "no email"}>`,
        `Org name: ${metadata.legalName}`,
        `Org type: ${metadata.orgType}`,
        `Contact: ${metadata.contactEmail}`,
        `Supporting URL: ${metadata.supportingUrl ?? "(none)"}`,
        "",
        metadata.description,
        "",
        `Review at: ${adminUrl}`,
      ];
      const text = rows.join("\n");
      const html = `
<p><strong>New circle verification application</strong></p>
<table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">
  <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Circle</td><td>${escapeHtml(circle.name)} (id: ${circle.id})</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Owner</td><td>${escapeHtml(req.dbUser!.displayName ?? "")} &lt;${escapeHtml(req.dbUser!.email ?? "no email")}&gt;</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Org name</td><td>${escapeHtml(metadata.legalName)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Org type</td><td>${escapeHtml(metadata.orgType)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Contact</td><td>${escapeHtml(metadata.contactEmail)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#6b7280">URL</td><td>${metadata.supportingUrl ? `<a href="${escapeHtml(metadata.supportingUrl)}">${escapeHtml(metadata.supportingUrl)}</a>` : "(none)"}</td></tr>
</table>
<p style="white-space:pre-wrap">${escapeHtml(metadata.description)}</p>
<p style="margin-top:24px">
  <a href="${adminUrl}" style="background:#e05a2b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Review in admin panel →</a>
</p>`;
      void sendEmail({
        to: adminEmail,
        subject: `[MyZolve] Verify circle: ${circle.name}`,
        text,
        html,
      });
    }

    const [memberCount] = await db
      .select({ cnt: count() })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.status, "active"),
        ),
      );

    res.json(
      circleToApi(
        updated,
        Number(memberCount.cnt),
        "owner",
        false,
        await brandingForCircle(updated),
      ),
    );
  },
);

router.patch("/circles/:circleId", requireAuth, validateParams(circleIdParam), validateBody(updateCircleSchema), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

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

  const membership = await db
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

  if (!membership || !isOwnerOrAdmin(membership.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const {
    name,
    description,
    circleType,
    privacyMode,
    ledgerMode,
    currency,
    bannerObjectPath,
    accentColor,
    welcomeMessage,
  } = req.body as z.infer<typeof updateCircleSchema>;

  // ── Plus "Custom circle look" gating ────────────────────────────────────
  // Only owners (not admins) can customize the look, and only when they
  // currently have Plus. Setting any field to null/empty (i.e. clearing
  // it) is always allowed so circles never get stuck in a paid look
  // after the owner cancels.
  const lookFieldTouched =
    bannerObjectPath !== undefined ||
    accentColor !== undefined ||
    welcomeMessage !== undefined;
  const lookFieldSet =
    (bannerObjectPath !== undefined && bannerObjectPath) ||
    (accentColor !== undefined && accentColor) ||
    (welcomeMessage !== undefined && welcomeMessage);

  if (lookFieldTouched && circle.ownerId !== userId) {
    res.status(403).json({
      error: "Only the circle owner can change the look & feel.",
    });
    return;
  }

  if (lookFieldSet) {
    const ownerHasPlus = await isPlus(req.dbUser!.clerkId);
    if (!ownerHasPlus) {
      res.status(402).json({
        error: "plus_required",
        reason: "circle_look",
        message: "MyZolve Connect Plus is required to customize your circle's look.",
      });
      return;
    }
  }

  if (accentColor !== undefined && accentColor !== null && accentColor !== "") {
    if (!isAllowedAccentColor(accentColor)) {
      res
        .status(400)
        .json({ error: "Pick an accent color from the curated palette." });
      return;
    }
  }

  // The banner upload was registered against this user + circle when
  // we minted the upload URL. Validate-and-consume that pending token
  // before we persist the path.
  let bannerToPersist: string | null | undefined = bannerObjectPath;
  if (bannerObjectPath && bannerObjectPath.length > 0) {
    const valid = validateAndConsumePendingUpload(
      bannerObjectPath,
      userId,
      circleId,
    );
    if (!valid) {
      res
        .status(400)
        .json({ error: "Banner upload session expired. Please re-pick the image." });
      return;
    }
  } else if (bannerObjectPath === "" || bannerObjectPath === null) {
    bannerToPersist = null;
  }

  const trimmedWelcome =
    welcomeMessage === undefined
      ? undefined
      : welcomeMessage === null || welcomeMessage.trim() === ""
        ? null
        : welcomeMessage.trim();

  const [updated] = await db
    .update(circlesTable)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(circleType !== undefined && { circleType }),
      ...(privacyMode !== undefined && { privacyMode }),
      ...(ledgerMode !== undefined && { ledgerMode }),
      ...(currency !== undefined && { currency }),
      ...(bannerToPersist !== undefined && { bannerObjectPath: bannerToPersist }),
      ...(accentColor !== undefined && {
        accentColor: accentColor === "" ? null : accentColor,
      }),
      ...(trimmedWelcome !== undefined && { welcomeMessage: trimmedWelcome }),
    })
    .where(eq(circlesTable.id, circleId))
    .returning();

  // When the owner publishes a new welcome message, reset every member's
  // dismissal so they all get to see the refreshed greeting once.
  if (
    trimmedWelcome !== undefined &&
    trimmedWelcome !== null &&
    trimmedWelcome !== circle.welcomeMessage
  ) {
    await db
      .update(circleMembersTable)
      .set({ welcomeDismissedAt: null })
      .where(eq(circleMembersTable.circleId, circleId));
  }

  const [memberCount] = await db
    .select({ cnt: count() })
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, circleId),
        eq(circleMembersTable.status, "active"),
      ),
    );

  const role = updated.ownerId === userId ? "owner" : membership.role;

  const changedFields: Record<string, unknown> = {};
  if (name !== undefined) changedFields.name = name;
  if (description !== undefined) changedFields.description = description;
  if (circleType !== undefined) changedFields.circleType = circleType;
  if (privacyMode !== undefined) changedFields.privacyMode = privacyMode;
  if (ledgerMode !== undefined) changedFields.ledgerMode = ledgerMode;
  if (currency !== undefined) changedFields.currency = currency;
  if (bannerToPersist !== undefined) changedFields.bannerObjectPath = bannerToPersist;
  if (accentColor !== undefined) changedFields.accentColor = accentColor;
  if (trimmedWelcome !== undefined) changedFields.welcomeMessage = trimmedWelcome;

  await createAuditLog({
    actorUserId: userId,
    circleId,
    action: privacyMode !== undefined ? "circle_privacy_changed" : "circle_settings_updated",
    targetEntityType: "circle",
    targetEntityId: circleId,
    metadata: changedFields,
  });

  res.json(
    circleToApi(
      updated,
      Number(memberCount.cnt),
      role,
      false,
      await brandingForCircle(updated),
    ),
  );
});

router.delete("/circles/:circleId", requireAuth, validateParams(circleIdParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

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
    res.status(403).json({ error: "Only the owner can delete a circle" });
    return;
  }

  await db.delete(circlesTable).where(eq(circlesTable.id, circleId));
  res.status(204).end();
});

router.get("/circles/:circleId/stats", requireAuth, validateParams(circleIdParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const member = await db
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

  if (!member) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const [totalMembersRow] = await db
    .select({ cnt: count() })
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, circleId),
        eq(circleMembersTable.status, "active"),
      ),
    );

  const isAdminOrOwner = canManageLedger(member.role);

  const isRequestVisible = (r: { visibilityScope: string | null; createdByUserId: number }) => {
    if (isAdminOrOwner) return true;
    if (r.visibilityScope === "private_draft" || r.visibilityScope === "admins_only") {
      return r.createdByUserId === userId;
    }
    return true;
  };

  const allOpenRequests = await db
    .select({ visibilityScope: supportRequestsTable.visibilityScope, createdByUserId: supportRequestsTable.createdByUserId })
    .from(supportRequestsTable)
    .where(and(eq(supportRequestsTable.circleId, circleId), eq(supportRequestsTable.status, "open")));

  const openRow = { cnt: allOpenRequests.filter(isRequestVisible).length };

  const allCompletedRequests = await db
    .select({ visibilityScope: supportRequestsTable.visibilityScope, createdByUserId: supportRequestsTable.createdByUserId })
    .from(supportRequestsTable)
    .where(and(eq(supportRequestsTable.circleId, circleId), eq(supportRequestsTable.status, "completed")));

  const completedRow = { cnt: allCompletedRequests.filter(isRequestVisible).length };

  const allActiveServices = await db
    .select({ visibilityScope: servicePostsTable.visibilityScope, createdByUserId: servicePostsTable.createdByUserId })
    .from(servicePostsTable)
    .where(and(eq(servicePostsTable.circleId, circleId), eq(servicePostsTable.status, "open")));

  const activeServicesRow = {
    cnt: isAdminOrOwner
      ? allActiveServices.length
      : allActiveServices.filter((s) => {
          if (s.visibilityScope === "admins_only") return s.createdByUserId === userId;
          return true;
        }).length,
  };

  const [recentActivityRow] = await db
    .select({ cnt: count() })
    .from(activityFeedItemsTable)
    .where(eq(activityFeedItemsTable.circleId, circleId));

  const contributionsSent = await db
    .select({
      total: sql<string>`COALESCE(SUM(${supportContributionsTable.amount}), 0)`,
    })
    .from(supportContributionsTable)
    .innerJoin(
      supportRequestsTable,
      eq(supportContributionsTable.requestId, supportRequestsTable.id),
    )
    .where(
      and(
        eq(supportRequestsTable.circleId, circleId),
        eq(supportContributionsTable.contributorUserId, userId),
        eq(supportContributionsTable.status, "confirmed"),
      ),
    )
    .then((r) => parseFloat(r[0]?.total ?? "0"));

  const contributionsReceived = await db
    .select({
      total: sql<string>`COALESCE(SUM(${supportContributionsTable.amount}), 0)`,
    })
    .from(supportContributionsTable)
    .innerJoin(
      supportRequestsTable,
      eq(supportContributionsTable.requestId, supportRequestsTable.id),
    )
    .where(
      and(
        eq(supportRequestsTable.circleId, circleId),
        eq(supportRequestsTable.createdByUserId, userId),
        eq(supportContributionsTable.status, "confirmed"),
      ),
    )
    .then((r) => parseFloat(r[0]?.total ?? "0"));

  res.json({
    circleId,
    totalMembers: Number(totalMembersRow.cnt),
    openRequests: Number(openRow.cnt),
    completedRequests: Number(completedRow.cnt),
    totalSupportGiven: contributionsSent,
    totalSupportReceived: contributionsReceived,
    activeServices: Number(activeServicesRow.cnt),
    recentActivityCount: Number(recentActivityRow.cnt),
  });
});

// ── Admin: verified-circle queue ────────────────────────────────────────
// Mirrors the operations in scripts/src/verifyCircle.ts but exposed as an
// authenticated API so a future admin UI doesn't need shell access.

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

router.get("/admin/circles/verifications", requireAuth, async (req, res) => {
  if (!isVerificationAdmin(req.dbUser?.email)) {
    res.status(403).json({ error: "Verification admin access required" });
    return;
  }

  const rows = await db
    .select({
      circleId: circlesTable.id,
      circleName: circlesTable.name,
      ownerId: circlesTable.ownerId,
      ownerName: usersTable.displayName,
      ownerEmail: usersTable.email,
      appliedAt: circlesTable.verificationAppliedAt,
      metadata: circlesTable.verificationMetadata,
    })
    .from(circlesTable)
    .leftJoin(usersTable, eq(circlesTable.ownerId, usersTable.id))
    .where(eq(circlesTable.verificationStatus, "pending"))
    .orderBy(circlesTable.verificationAppliedAt);

  res.json(
    rows.map((r) => {
      let meta: Record<string, unknown> = {};
      if (r.metadata) {
        try {
          meta = JSON.parse(r.metadata);
        } catch {
          meta = {};
        }
      }
      return {
        circleId: r.circleId,
        circleName: r.circleName,
        ownerId: r.ownerId,
        ownerName: r.ownerName,
        ownerEmail: r.ownerEmail,
        appliedAt: r.appliedAt ? r.appliedAt.toISOString() : null,
        legalName: (meta.legalName as string) ?? null,
        orgType: (meta.orgType as string) ?? null,
        description: (meta.description as string) ?? null,
        contactEmail: (meta.contactEmail as string) ?? null,
        supportingUrl: (meta.supportingUrl as string) ?? null,
      };
    }),
  );
});

router.post(
  "/admin/circles/:circleId/verification/decision",
  requireAuth,
  validateParams(circleIdParam),
  validateBody(decisionSchema),
  async (req, res) => {
    if (!isVerificationAdmin(req.dbUser?.email)) {
      res.status(403).json({ error: "Verification admin access required" });
      return;
    }

    const circleId = parseInt(String(req.params.circleId));
    const { decision, reason } = req.body as z.infer<typeof decisionSchema>;
    if (decision === "reject" && (!reason || reason.trim().length === 0)) {
      res.status(400).json({ error: "Reject decisions require a reason." });
      return;
    }

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
    if (circle.verificationStatus !== "pending") {
      res.status(409).json({
        error: `Circle is in status "${circle.verificationStatus}", expected "pending".`,
      });
      return;
    }

    const newStatus = decision === "approve" ? "verified" : "rejected";
    const decisionReason = reason?.trim() || (decision === "approve" ? "Approved" : "");

    const [updated] = await db
      .update(circlesTable)
      .set({
        verificationStatus: newStatus,
        verificationDecisionReason: decisionReason || null,
      })
      .where(eq(circlesTable.id, circleId))
      .returning();

    await createAuditLog({
      actorUserId: req.dbUser!.id,
      circleId,
      action:
        decision === "approve"
          ? "circle_verification_approved"
          : "circle_verification_rejected",
      targetEntityType: "circle",
      targetEntityId: circleId,
      metadata: { reason: decisionReason },
    });

    await createNotification({
      userId: updated.ownerId,
      circleId,
      notificationType:
        decision === "approve"
          ? "circle_verified"
          : "circle_verification_rejected",
      title:
        decision === "approve"
          ? "Your circle is now verified"
          : "Your verification application was declined",
      body:
        decision === "approve"
          ? `${updated.name} now shows the Verified badge to all members.`
          : `${updated.name}: ${decisionReason}`,
      targetEntityType: "circle",
      targetEntityId: circleId,
    });

    const [memberCount] = await db
      .select({ cnt: count() })
      .from(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, circleId),
          eq(circleMembersTable.status, "active"),
        ),
      );

    res.json(
      circleToApi(
        updated,
        Number(memberCount.cnt),
        "owner",
        false,
        await brandingForCircle(updated),
      ),
    );
  },
);

// ── Shared helpers ──────────────────────────────────────────────────────────

function webBaseUrl(): string {
  const explicit = process.env["WEB_APP_URL"];
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  if (prod) return `https://${prod}`;
  const dev = process.env["REPLIT_DEV_DOMAIN"];
  if (dev) return `https://${dev}`;
  return "https://myzolve.com";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default router;
