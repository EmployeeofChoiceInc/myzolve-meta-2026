import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { randomBytes } from "crypto";
import { z } from "zod";
import { and, eq, count, desc } from "drizzle-orm";
import {
  db,
  orgsTable,
  orgMembersTable,
  orgInvitesTable,
  orgAnnouncementsTable,
  orgEventsTable,
  circlesTable,
  usersTable,
  type Org,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams } from "../middlewares/validate";
import { logger } from "../lib/logger";
import { ORG_PLANS, getOrgPlan } from "../lib/orgPlans";
import { isOrgSeatActive } from "../lib/orgEntitlement";
import { isOrgComped, getActiveOrgCompIds } from "../lib/comps";
import {
  createOrgCheckoutSession,
  createOrgPortalSession,
} from "../lib/orgStripe";
import { bustIsPlusCache } from "../lib/revenuecat";
import { ObjectStorageService } from "../lib/objectStorage";
import { registerPendingUpload, validateAndConsumePendingUpload } from "../lib/uploadTokens";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const orgIdParam = z.object({
  orgId: z.coerce.number().int().positive(),
});
const orgInviteIdParam = z.object({
  orgId: z.coerce.number().int().positive(),
  inviteId: z.coerce.number().int().positive(),
});
const orgMemberIdParam = z.object({
  orgId: z.coerce.number().int().positive(),
  memberId: z.coerce.number().int().positive(),
});
const orgTokenParam = z.object({
  token: z.string().min(1).max(200),
});

const createOrgSchema = z.object({
  name: z.string().min(1).max(120),
  plan: z.enum(["reunion", "erg"]),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  accentColor: z.string().max(16).nullable().optional(),
  logoObjectPath: z.string().max(1000).nullable().optional(),
  welcomeMessage: z.string().max(2000).nullable().optional(),
  coverImageObjectPath: z.string().max(1000).nullable().optional(),
  heroEventDate: z.string().datetime().nullable().optional(),
});

const checkoutSchema = z.object({
  // For per-seat plans the buyer chooses the seat count; ignored otherwise.
  seats: z.coerce.number().int().min(1).max(1000).optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const portalSchema = z.object({
  returnUrl: z.string().url(),
});

const createInviteSchema = z.object({
  // Null/omitted → a shareable link invite (anyone with the link can accept).
  email: z.string().email().max(320).optional(),
  role: z.enum(["admin", "member"]).optional().default("member"),
});

const createAnnouncementSchema = z.object({
  title: z.string().max(160).nullable().optional(),
  body: z.string().min(1).max(5000),
});

const createEventSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(5000).nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
});

const orgAnnouncementIdParam = z.object({
  orgId: z.coerce.number().int().positive(),
  announcementId: z.coerce.number().int().positive(),
});

const orgEventIdParam = z.object({
  orgId: z.coerce.number().int().positive(),
  eventId: z.coerce.number().int().positive(),
});

function orgToApi(
  org: Org,
  opts: { seatsUsed?: number; myRole?: string | null; isComped?: boolean } = {},
) {
  const plan = getOrgPlan(org.plan);
  const comped = opts.isComped ?? false;
  return {
    id: org.id,
    name: org.name,
    ownerId: org.ownerId,
    plan: org.plan,
    planName: plan?.name ?? org.plan,
    billingType: org.billingType,
    status: org.status,
    seatLimit: org.seatLimit,
    seatsUsed: opts.seatsUsed ?? null,
    logoUrl: org.logoObjectPath ? `/api/orgs/${org.id}/logo` : null,
    accentColor: org.accentColor,
    currentPeriodEnd: org.currentPeriodEnd,
    cancelAtPeriodEnd: org.cancelAtPeriodEnd === "true",
    graceEndsAt: org.graceEndsAt,
    isActive: isOrgSeatActive(org) || comped,
    comped,
    myRole: opts.myRole ?? null,
    createdAt: org.createdAt,
  };
}

/** Load the caller's org membership row, or null. */
async function getMembership(orgId: number, userId: number) {
  return db
    .select()
    .from(orgMembersTable)
    .where(
      and(eq(orgMembersTable.orgId, orgId), eq(orgMembersTable.userId, userId)),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
}

async function countActiveSeats(orgId: number): Promise<number> {
  const [row] = await db
    .select({ cnt: count() })
    .from(orgMembersTable)
    .where(
      and(eq(orgMembersTable.orgId, orgId), eq(orgMembersTable.status, "active")),
    );
  return Number(row?.cnt ?? 0);
}

/**
 * Require the caller to be an owner/admin of the org. Returns the org +
 * membership on success, or sends an error response and returns null.
 */
async function requireOrgAdmin(
  req: Request,
  res: Response,
  orgId: number,
): Promise<{ org: Org; role: string } | null> {
  const userId = req.dbUser!.id;
  const org = await db
    .select()
    .from(orgsTable)
    .where(eq(orgsTable.id, orgId))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!org) {
    res.status(404).json({ error: "Org not found" });
    return null;
  }
  const membership = await getMembership(orgId, userId);
  const isAdmin =
    org.ownerId === userId ||
    (membership?.status === "active" &&
      (membership.role === "owner" || membership.role === "admin"));
  if (!isAdmin) {
    res.status(403).json({ error: "You must be an org admin to do this" });
    return null;
  }
  return { org, role: membership?.role ?? "owner" };
}

/**
 * Require the caller to be an active member (any role) of the org — used for
 * the member-facing Reunion Home. Returns the org + role, or sends an error.
 */
async function requireOrgMember(
  req: Request,
  res: Response,
  orgId: number,
): Promise<{ org: Org; role: string } | null> {
  const userId = req.dbUser!.id;
  const org = await db
    .select()
    .from(orgsTable)
    .where(eq(orgsTable.id, orgId))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!org) {
    res.status(404).json({ error: "Org not found" });
    return null;
  }
  const membership = await getMembership(orgId, userId);
  const isMember =
    org.ownerId === userId || membership?.status === "active";
  if (!isMember) {
    res
      .status(403)
      .json({ error: "You must be a member of this organization." });
    return null;
  }
  return {
    org,
    role: membership?.role ?? (org.ownerId === userId ? "owner" : "member"),
  };
}

// GET /org-plans — public catalog of seat-pack plans.
router.get("/org-plans", (_req, res) => {
  res.json({
    plans: Object.values(ORG_PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      billingType: p.billingType,
      seats: p.seats,
      perSeat: p.perSeat,
      minSeats: p.minSeats,
      maxSeats: p.maxSeats,
      unitAmount: p.unitAmount,
      currency: p.currency,
    })),
  });
});

// POST /orgs — create a pending org. The creator becomes owner + first member.
router.post("/orgs", requireAuth, validateBody(createOrgSchema), async (req, res) => {
  const user = req.dbUser!;
  const { name, plan: planId } = req.body as z.infer<typeof createOrgSchema>;
  const plan = getOrgPlan(planId);
  if (!plan) {
    res.status(400).json({ error: "Unknown plan" });
    return;
  }

  const [org] = await db
    .insert(orgsTable)
    .values({
      name: name.trim(),
      ownerId: user.id,
      plan: plan.id,
      billingType: plan.billingType,
      seatLimit: plan.perSeat ? 0 : plan.seats,
      status: "pending",
    })
    .returning();

  await db
    .insert(orgMembersTable)
    .values({ orgId: org.id, userId: user.id, role: "owner", status: "active" })
    .onConflictDoNothing();

  // Onboard the admin by email (best-effort).
  void sendOrgAdminOnboardingEmail(org, user.email, user.displayName).catch(
    (err) => logger.warn({ err, orgId: org.id }, "Admin onboarding email failed"),
  );

  res.status(201).json(orgToApi(org, { seatsUsed: 1, myRole: "owner" }));
});

// GET /orgs/mine — orgs the caller belongs to (as owner/admin/member).
router.get("/orgs/mine", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const rows = await db
    .select({ org: orgsTable, role: orgMembersTable.role })
    .from(orgMembersTable)
    .innerJoin(orgsTable, eq(orgsTable.id, orgMembersTable.orgId))
    .where(
      and(
        eq(orgMembersTable.userId, userId),
        eq(orgMembersTable.status, "active"),
      ),
    );
  const compedIds = await getActiveOrgCompIds(rows.map((r) => r.org.id));
  const out = [];
  for (const r of rows) {
    const seatsUsed = await countActiveSeats(r.org.id);
    out.push(
      orgToApi(r.org, {
        seatsUsed,
        myRole: r.role,
        isComped: compedIds.has(r.org.id),
      }),
    );
  }
  res.json({ orgs: out });
});

// GET /orgs/:orgId — admin dashboard payload (org + members + seats).
router.get(
  "/orgs/:orgId",
  requireAuth,
  validateParams(orgIdParam),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;

    const seatsUsed = await countActiveSeats(orgId);
    const members = await db
      .select({
        id: orgMembersTable.id,
        userId: orgMembersTable.userId,
        role: orgMembersTable.role,
        status: orgMembersTable.status,
        joinedAt: orgMembersTable.joinedAt,
        displayName: usersTable.displayName,
        email: usersTable.email,
        avatarObjectPath: usersTable.avatarObjectPath,
      })
      .from(orgMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, orgMembersTable.userId))
      .where(
        and(
          eq(orgMembersTable.orgId, orgId),
          eq(orgMembersTable.status, "active"),
        ),
      );

    const invites = await db
      .select({
        id: orgInvitesTable.id,
        email: orgInvitesTable.invitedEmail,
        role: orgInvitesTable.role,
        token: orgInvitesTable.token,
        status: orgInvitesTable.status,
        expiresAt: orgInvitesTable.expiresAt,
        createdAt: orgInvitesTable.createdAt,
      })
      .from(orgInvitesTable)
      .where(
        and(
          eq(orgInvitesTable.orgId, orgId),
          eq(orgInvitesTable.status, "pending"),
        ),
      );

    const comped = await isOrgComped(orgId);
    res.json({
      org: orgToApi(admin.org, { seatsUsed, myRole: admin.role, isComped: comped }),
      members,
      pendingInvites: invites,
    });
  },
);

// PATCH /orgs/:orgId — update name + branding (admin only).
router.patch(
  "/orgs/:orgId",
  requireAuth,
  validateParams(orgIdParam),
  validateBody(updateOrgSchema),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;
    const body = req.body as z.infer<typeof updateOrgSchema>;

    const updates: Partial<typeof orgsTable.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.accentColor !== undefined) updates.accentColor = body.accentColor;
    if (body.logoObjectPath !== undefined) {
      if (body.logoObjectPath === null) {
        updates.logoObjectPath = null;
      } else {
        const ok = validateAndConsumePendingUpload(
          body.logoObjectPath,
          req.dbUser!.id,
          -1,
        );
        if (!ok) {
          res.status(400).json({ error: "Invalid or expired logo upload token" });
          return;
        }
        updates.logoObjectPath = body.logoObjectPath;
      }
    }
    if (body.welcomeMessage !== undefined)
      updates.welcomeMessage = body.welcomeMessage;
    if (body.heroEventDate !== undefined)
      updates.heroEventDate = body.heroEventDate
        ? new Date(body.heroEventDate)
        : null;
    if (body.coverImageObjectPath !== undefined) {
      if (body.coverImageObjectPath === null) {
        updates.coverImageObjectPath = null;
      } else {
        const ok = validateAndConsumePendingUpload(
          body.coverImageObjectPath,
          req.dbUser!.id,
          -1,
        );
        if (!ok) {
          res
            .status(400)
            .json({ error: "Invalid or expired image upload token" });
          return;
        }
        updates.coverImageObjectPath = body.coverImageObjectPath;
      }
    }

    const [updated] = await db
      .update(orgsTable)
      .set(updates)
      .where(eq(orgsTable.id, orgId))
      .returning();
    const seatsUsed = await countActiveSeats(orgId);
    const comped = await isOrgComped(orgId);
    res.json(orgToApi(updated, { seatsUsed, myRole: admin.role, isComped: comped }));
  },
);

// POST /orgs/:orgId/logo/request-url — presigned upload for the org logo.
router.post(
  "/orgs/:orgId/logo/request-url",
  requireAuth,
  validateParams(orgIdParam),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;
    const { name, size, contentType } = req.body as {
      name?: string;
      size?: number;
      contentType?: string;
    };
    if (!name || !size || !contentType) {
      res.status(400).json({ error: "Missing required fields: name, size, contentType" });
      return;
    }
    if (!contentType.startsWith("image/")) {
      res.status(400).json({ error: "Only image files are allowed for logos" });
      return;
    }
    if (size > 5 * 1024 * 1024) {
      res.status(400).json({ error: "Logo image must be under 5 MB" });
      return;
    }
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      registerPendingUpload(objectPath, req.dbUser!.id, -1);
      res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    } catch (error) {
      logger.error({ err: error }, "Error generating org logo upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

// GET /orgs/:orgId/logo — public stream of the org logo (branding on invite
// previews shown to signed-out users), no auth required.
router.get(
  "/orgs/:orgId/logo",
  validateParams(orgIdParam),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const org = await db
      .select({ logoObjectPath: orgsTable.logoObjectPath })
      .from(orgsTable)
      .where(eq(orgsTable.id, orgId))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!org?.logoObjectPath) {
      res.status(404).json({ error: "No logo" });
      return;
    }
    try {
      const file = await objectStorageService.getObjectEntityFile(org.logoObjectPath);
      const response = await objectStorageService.downloadObject(file, 86400);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      logger.error({ err: error, orgId }, "Error serving org logo");
      res.status(404).json({ error: "No logo" });
    }
  },
);

// POST /orgs/:orgId/checkout — create a Stripe Checkout Session (admin only).
router.post(
  "/orgs/:orgId/checkout",
  requireAuth,
  validateParams(orgIdParam),
  validateBody(checkoutSchema),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;
    if (await isOrgComped(orgId)) {
      res.status(400).json({
        error:
          "This organization has complimentary access — no payment is needed.",
      });
      return;
    }
    const { seats, successUrl, cancelUrl } = req.body as z.infer<typeof checkoutSchema>;
    const plan = getOrgPlan(admin.org.plan);
    if (!plan) {
      res.status(400).json({ error: "Org has no plan configured" });
      return;
    }
    const seatCount = plan.perSeat
      ? Math.min(Math.max(seats ?? plan.minSeats, plan.minSeats), plan.maxSeats)
      : plan.seats;

    try {
      const { url } = await createOrgCheckoutSession({
        org: admin.org,
        plan,
        seats: seatCount,
        successUrl,
        cancelUrl,
        customerEmail: req.dbUser!.email ?? "",
      });
      if (!url) {
        res.status(502).json({ error: "Stripe did not return a checkout URL" });
        return;
      }
      res.json({ url });
    } catch (err) {
      logger.error({ err, orgId }, "Failed to create org checkout session");
      res.status(502).json({
        error: "Billing is not available right now. Please try again shortly.",
      });
    }
  },
);

// POST /orgs/:orgId/portal — open the Stripe billing portal (admin only).
router.post(
  "/orgs/:orgId/portal",
  requireAuth,
  validateParams(orgIdParam),
  validateBody(portalSchema),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;
    if (await isOrgComped(orgId)) {
      res.status(400).json({
        error:
          "This organization has complimentary access — there is no billing account to manage.",
      });
      return;
    }
    if (!admin.org.stripeCustomerId) {
      res.status(400).json({ error: "No billing account yet. Complete checkout first." });
      return;
    }
    const { returnUrl } = req.body as z.infer<typeof portalSchema>;
    try {
      const url = await createOrgPortalSession({
        customerId: admin.org.stripeCustomerId,
        returnUrl,
      });
      if (!url) {
        res.status(502).json({ error: "Stripe did not return a portal URL" });
        return;
      }
      res.json({ url });
    } catch (err) {
      logger.error({ err, orgId }, "Failed to create billing portal session");
      res.status(502).json({ error: "Billing portal is not available right now." });
    }
  },
);

// POST /orgs/:orgId/invites — create an email or shareable-link invite.
router.post(
  "/orgs/:orgId/invites",
  requireAuth,
  validateParams(orgIdParam),
  validateBody(createInviteSchema),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;
    const { email, role } = req.body as z.infer<typeof createInviteSchema>;

    // Seat capacity guard: pending invites + active members must not exceed
    // the seat limit (only enforced once the org is active with a known limit).
    if (admin.org.seatLimit > 0) {
      const seatsUsed = await countActiveSeats(orgId);
      const [pending] = await db
        .select({ cnt: count() })
        .from(orgInvitesTable)
        .where(
          and(
            eq(orgInvitesTable.orgId, orgId),
            eq(orgInvitesTable.status, "pending"),
          ),
        );
      if (seatsUsed + Number(pending?.cnt ?? 0) >= admin.org.seatLimit) {
        res.status(409).json({
          error: "No seats available. Add seats or remove members first.",
        });
        return;
      }
    }

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [invite] = await db
      .insert(orgInvitesTable)
      .values({
        orgId,
        invitedEmail: email ?? null,
        invitedByUserId: req.dbUser!.id,
        role,
        token,
        status: "pending",
        expiresAt,
      })
      .returning();

    if (email) {
      void sendOrgInviteEmail(admin.org, email, token, req.dbUser!.displayName).catch(
        (err) => logger.warn({ err, orgId }, "Org invite email failed"),
      );
    }

    res.status(201).json({
      id: invite.id,
      email: invite.invitedEmail,
      role: invite.role,
      token: invite.token,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    });
  },
);

// DELETE /orgs/:orgId/invites/:inviteId — revoke a pending invite.
router.delete(
  "/orgs/:orgId/invites/:inviteId",
  requireAuth,
  validateParams(orgInviteIdParam),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const inviteId = Number(req.params.inviteId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;
    await db
      .update(orgInvitesTable)
      .set({ status: "revoked" })
      .where(
        and(eq(orgInvitesTable.id, inviteId), eq(orgInvitesTable.orgId, orgId)),
      );
    res.json({ ok: true });
  },
);

// DELETE /orgs/:orgId/members/:memberId — remove a member (frees their seat).
router.delete(
  "/orgs/:orgId/members/:memberId",
  requireAuth,
  validateParams(orgMemberIdParam),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const memberId = Number(req.params.memberId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;

    const member = await db
      .select()
      .from(orgMembersTable)
      .where(
        and(eq(orgMembersTable.id, memberId), eq(orgMembersTable.orgId, orgId)),
      )
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (member.role === "owner") {
      res.status(400).json({ error: "The org owner cannot be removed" });
      return;
    }

    await db
      .update(orgMembersTable)
      .set({ status: "removed" })
      .where(eq(orgMembersTable.id, memberId));

    // Drop the seat immediately so the removed member loses Plus right away.
    const removedUser = await db
      .select({ clerkId: usersTable.clerkId })
      .from(usersTable)
      .where(eq(usersTable.id, member.userId))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (removedUser?.clerkId) bustIsPlusCache(removedUser.clerkId);

    res.json({ ok: true });
  },
);

// GET /orgs/:orgId/cover — member-gated stream of the org cover image (hero).
router.get(
  "/orgs/:orgId/cover",
  requireAuth,
  validateParams(orgIdParam),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const m = await requireOrgMember(req, res, orgId);
    if (!m) return;
    if (!m.org.coverImageObjectPath) {
      res.status(404).json({ error: "No cover image" });
      return;
    }
    try {
      const file = await objectStorageService.getObjectEntityFile(
        m.org.coverImageObjectPath,
      );
      const response = await objectStorageService.downloadObject(file, 86400);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      logger.error({ err: error, orgId }, "Error serving org cover image");
      res.status(404).json({ error: "No cover image" });
    }
  },
);

// GET /orgs/:orgId/home — the member-facing Reunion Home ("front door").
// Aggregates the org profile, organizer announcements, upcoming events, the
// circles inside the org, and a member directory preview. Any active member
// (or the owner) may view it.
router.get(
  "/orgs/:orgId/home",
  requireAuth,
  validateParams(orgIdParam),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const m = await requireOrgMember(req, res, orgId);
    if (!m) return;

    const seatsUsed = await countActiveSeats(orgId);
    const comped = await isOrgComped(orgId);
    const canManage =
      m.org.ownerId === req.dbUser!.id ||
      m.role === "owner" ||
      m.role === "admin";

    const announcementRows = await db
      .select({
        id: orgAnnouncementsTable.id,
        title: orgAnnouncementsTable.title,
        body: orgAnnouncementsTable.body,
        createdAt: orgAnnouncementsTable.createdAt,
        authorUserId: orgAnnouncementsTable.authorUserId,
        authorName: usersTable.displayName,
        authorAvatarObjectPath: usersTable.avatarObjectPath,
      })
      .from(orgAnnouncementsTable)
      .innerJoin(
        usersTable,
        eq(usersTable.id, orgAnnouncementsTable.authorUserId),
      )
      .where(eq(orgAnnouncementsTable.orgId, orgId))
      .orderBy(desc(orgAnnouncementsTable.createdAt))
      .limit(25);

    const now = Date.now();
    const eventRows = await db
      .select()
      .from(orgEventsTable)
      .where(eq(orgEventsTable.orgId, orgId))
      .orderBy(orgEventsTable.startsAt);
    const events = eventRows
      .filter((e) => (e.endsAt ?? e.startsAt).getTime() >= now)
      .slice(0, 25)
      .map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
      }));

    const circleRows = await db
      .select({
        id: circlesTable.id,
        name: circlesTable.name,
        description: circlesTable.description,
        privacyMode: circlesTable.privacyMode,
        accentColor: circlesTable.accentColor,
      })
      .from(circlesTable)
      .where(eq(circlesTable.orgId, orgId));

    const memberRows = await db
      .select({
        userId: orgMembersTable.userId,
        role: orgMembersTable.role,
        displayName: usersTable.displayName,
        avatarObjectPath: usersTable.avatarObjectPath,
      })
      .from(orgMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, orgMembersTable.userId))
      .where(
        and(
          eq(orgMembersTable.orgId, orgId),
          eq(orgMembersTable.status, "active"),
        ),
      );

    res.json({
      org: {
        ...orgToApi(m.org, { seatsUsed, myRole: m.role, isComped: comped }),
        welcomeMessage: m.org.welcomeMessage,
        coverImageUrl: m.org.coverImageObjectPath
          ? `/api/orgs/${orgId}/cover`
          : null,
        heroEventDate: m.org.heroEventDate,
      },
      canManage,
      announcements: announcementRows.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        createdAt: a.createdAt,
        authorName: a.authorName,
        authorAvatarObjectPath: a.authorAvatarObjectPath,
      })),
      events,
      circles: circleRows,
      memberCount: memberRows.length,
      members: memberRows.slice(0, 18).map((mm) => ({
        userId: mm.userId,
        role: mm.role,
        displayName: mm.displayName,
        avatarObjectPath: mm.avatarObjectPath,
      })),
    });
  },
);

// POST /orgs/:orgId/announcements — post an organizer announcement (admin).
router.post(
  "/orgs/:orgId/announcements",
  requireAuth,
  validateParams(orgIdParam),
  validateBody(createAnnouncementSchema),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;
    const { title, body } = req.body as z.infer<
      typeof createAnnouncementSchema
    >;
    const [row] = await db
      .insert(orgAnnouncementsTable)
      .values({
        orgId,
        authorUserId: req.dbUser!.id,
        title: title ?? null,
        body: body.trim(),
      })
      .returning();
    res.status(201).json({
      id: row.id,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      authorName: req.dbUser!.displayName,
      authorAvatarObjectPath: req.dbUser!.avatarObjectPath ?? null,
    });
  },
);

// DELETE /orgs/:orgId/announcements/:announcementId — remove one (admin).
router.delete(
  "/orgs/:orgId/announcements/:announcementId",
  requireAuth,
  validateParams(orgAnnouncementIdParam),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const announcementId = Number(req.params.announcementId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;
    await db
      .delete(orgAnnouncementsTable)
      .where(
        and(
          eq(orgAnnouncementsTable.id, announcementId),
          eq(orgAnnouncementsTable.orgId, orgId),
        ),
      );
    res.json({ ok: true });
  },
);

// POST /orgs/:orgId/events — create an org-wide event (admin).
router.post(
  "/orgs/:orgId/events",
  requireAuth,
  validateParams(orgIdParam),
  validateBody(createEventSchema),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;
    const { title, description, location, startsAt, endsAt } = req.body as z.infer<
      typeof createEventSchema
    >;
    const [row] = await db
      .insert(orgEventsTable)
      .values({
        orgId,
        createdByUserId: req.dbUser!.id,
        title: title.trim(),
        description: description ?? null,
        location: location ?? null,
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
      })
      .returning();
    res.status(201).json({
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    });
  },
);

// DELETE /orgs/:orgId/events/:eventId — remove an event (admin).
router.delete(
  "/orgs/:orgId/events/:eventId",
  requireAuth,
  validateParams(orgEventIdParam),
  async (req, res) => {
    const orgId = Number(req.params.orgId);
    const eventId = Number(req.params.eventId);
    const admin = await requireOrgAdmin(req, res, orgId);
    if (!admin) return;
    await db
      .delete(orgEventsTable)
      .where(
        and(eq(orgEventsTable.id, eventId), eq(orgEventsTable.orgId, orgId)),
      );
    res.json({ ok: true });
  },
);

// GET /org-invites/:token — public preview of an invite (org name + branding).
router.get(
  "/org-invites/:token",
  validateParams(orgTokenParam),
  async (req, res) => {
    const token = String(req.params.token);
    const invite = await db
      .select({
        id: orgInvitesTable.id,
        orgId: orgInvitesTable.orgId,
        email: orgInvitesTable.invitedEmail,
        role: orgInvitesTable.role,
        status: orgInvitesTable.status,
        expiresAt: orgInvitesTable.expiresAt,
      })
      .from(orgInvitesTable)
      .where(eq(orgInvitesTable.token, token))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }
    const org = await db
      .select()
      .from(orgsTable)
      .where(eq(orgsTable.id, invite.orgId))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!org) {
      res.status(404).json({ error: "Org not found" });
      return;
    }
    const valid =
      invite.status === "pending" &&
      (!invite.expiresAt || invite.expiresAt.getTime() > Date.now());
    res.json({
      valid,
      status: invite.status,
      role: invite.role,
      invitedEmail: invite.email,
      org: {
        id: org.id,
        name: org.name,
        logoUrl: org.logoObjectPath ? `/api/orgs/${org.id}/logo` : null,
        accentColor: org.accentColor,
      },
    });
  },
);

// POST /org-invites/:token/accept — accept an invite, consuming a seat.
router.post(
  "/org-invites/:token/accept",
  requireAuth,
  validateParams(orgTokenParam),
  async (req, res) => {
    const token = String(req.params.token);
    const user = req.dbUser!;
    const invite = await db
      .select()
      .from(orgInvitesTable)
      .where(eq(orgInvitesTable.token, token))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }
    if (invite.status !== "pending") {
      res.status(409).json({ error: "This invite has already been used or revoked." });
      return;
    }
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      res.status(409).json({ error: "This invite has expired." });
      return;
    }
    // Email-targeted invites must be accepted by that email.
    if (
      invite.invitedEmail &&
      user.email &&
      invite.invitedEmail.toLowerCase() !== user.email.toLowerCase()
    ) {
      res.status(403).json({
        error: "This invite was sent to a different email address.",
      });
      return;
    }

    const org = await db
      .select()
      .from(orgsTable)
      .where(eq(orgsTable.id, invite.orgId))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!org) {
      res.status(404).json({ error: "Org not found" });
      return;
    }

    // Already a member? Just mark the invite accepted.
    const existing = await getMembership(org.id, user.id);
    if (existing && existing.status === "active") {
      await db
        .update(orgInvitesTable)
        .set({ status: "accepted", acceptedAt: new Date(), acceptedByUserId: user.id })
        .where(eq(orgInvitesTable.id, invite.id));
      bustIsPlusCache(user.clerkId);
      res.json({ orgId: org.id, orgName: org.name });
      return;
    }

    // Seat capacity guard.
    if (org.seatLimit > 0) {
      const seatsUsed = await countActiveSeats(org.id);
      if (seatsUsed >= org.seatLimit) {
        res.status(409).json({ error: "This organization has no seats available." });
        return;
      }
    }

    if (existing) {
      await db
        .update(orgMembersTable)
        .set({ status: "active", role: invite.role })
        .where(eq(orgMembersTable.id, existing.id));
    } else {
      await db
        .insert(orgMembersTable)
        .values({
          orgId: org.id,
          userId: user.id,
          role: invite.role,
          status: "active",
        })
        .onConflictDoNothing();
    }

    await db
      .update(orgInvitesTable)
      .set({ status: "accepted", acceptedAt: new Date(), acceptedByUserId: user.id })
      .where(eq(orgInvitesTable.id, invite.id));

    bustIsPlusCache(user.clerkId);
    res.json({ orgId: org.id, orgName: org.name });
  },
);

/** Transactional email: admin onboarding when an org is created. */
async function sendOrgAdminOnboardingEmail(
  org: Org,
  to: string | null,
  adminName: string | null,
): Promise<void> {
  if (!to) return;
  const { sendEmail } = await import("../lib/email");
  const dashUrl = orgDashboardUrl(org.id);
  const greeting = adminName ? `Hi ${adminName},` : "Hi,";
  const text = [
    greeting,
    "",
    `Your organization "${org.name}" is ready on MyZolve Connect.`,
    "",
    "Next steps:",
    "1. Complete checkout to activate your seats.",
    "2. Add your logo and accent color.",
    "3. Invite your members by email or shareable link.",
    "",
    `Open your admin dashboard: ${dashUrl}`,
  ].join("\n");
  await sendEmail({
    to,
    subject: `Welcome to MyZolve Connect — ${org.name}`,
    text,
    html: `<p>${greeting}</p><p>Your organization <strong>${escapeHtml(
      org.name,
    )}</strong> is ready on MyZolve Connect.</p><ol><li>Complete checkout to activate your seats.</li><li>Add your logo and accent color.</li><li>Invite your members by email or shareable link.</li></ol><p><a href="${dashUrl}">Open your admin dashboard</a></p>`,
  });
}

/** Transactional email: member invite. */
async function sendOrgInviteEmail(
  org: Org,
  to: string,
  token: string,
  inviterName: string | null,
): Promise<void> {
  const { sendEmail } = await import("../lib/email");
  const acceptUrl = orgInviteUrl(token);
  const inviter = inviterName ? `${inviterName} invited you` : "You've been invited";
  const text = [
    `${inviter} to join "${org.name}" on MyZolve Connect.`,
    "",
    "Joining gives you MyZolve Plus while you're a member.",
    "",
    `Accept your invite: ${acceptUrl}`,
  ].join("\n");
  await sendEmail({
    to,
    subject: `${inviter} to join ${org.name} on MyZolve Connect`,
    text,
    html: `<p>${escapeHtml(inviter)} to join <strong>${escapeHtml(
      org.name,
    )}</strong> on MyZolve Connect.</p><p>Joining gives you MyZolve Plus while you're a member.</p><p><a href="${acceptUrl}">Accept your invite</a></p>`,
  });
}

function webBaseUrl(): string {
  const explicit = process.env["WEB_APP_URL"];
  if (explicit) return explicit.replace(/\/$/, "");
  // Prefer the production deployment domain over the dev domain so invite/
  // dashboard links in emails point at the live app, not the (often-offline)
  // dev URL. Mirrors the domain resolution in lib/stripeInit.ts.
  const prod = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  if (prod) return `https://${prod}`;
  const dev = process.env["REPLIT_DEV_DOMAIN"];
  if (dev) return `https://${dev}`;
  return "https://myzolve.com";
}

function orgDashboardUrl(orgId: number): string {
  return `${webBaseUrl()}/orgs/${orgId}`;
}
function orgInviteUrl(token: string): string {
  return `${webBaseUrl()}/org-invite/${token}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default router;
