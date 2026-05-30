import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody, validateParams } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  circleBuilderApplicationsTable,
  usersTable,
  type CircleBuilderApplication,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

/**
 * Returns true if the requesting user's email matches the configured
 * admin allow-list. We reuse the same comma-separated
 * `VERIFICATION_ADMIN_EMAIL` env var the MyZolve team already uses for the
 * verified-circle queue rather than introduce a separate secret.
 */
function isProgramAdmin(email: string | null | undefined): boolean {
  const raw = process.env["VERIFICATION_ADMIN_EMAIL"];
  if (!raw || !email) return false;
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

const applicationIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

const createApplicationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  location: z.string().trim().min(1).max(200),
  communityServed: z.string().trim().min(1).max(2000),
  networkSize: z.string().trim().min(1).max(200),
  motivation: z.string().trim().min(1).max(4000),
  desiredImpact: z.string().trim().min(1).max(4000),
  willingToHost: z.boolean(),
});

const reviewApplicationSchema = z.object({
  status: z.enum(["pending", "approved", "declined"]),
  reviewNote: z.string().trim().max(2000).nullable().optional(),
});

function applicationToApi(
  app: CircleBuilderApplication,
  reviewedByName: string | null = null,
) {
  return {
    id: app.id,
    name: app.name,
    email: app.email,
    location: app.location,
    communityServed: app.communityServed,
    networkSize: app.networkSize,
    motivation: app.motivation,
    desiredImpact: app.desiredImpact,
    willingToHost: app.willingToHost,
    status: app.status,
    reviewedByUserId: app.reviewedByUserId,
    reviewedByName: app.reviewedByUserId ? reviewedByName : null,
    reviewedAt: app.reviewedAt,
    reviewNote: app.reviewNote,
    createdAt: app.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Lightweight in-memory rate limit for the PUBLIC submission endpoint.
// Keyed by client IP. Best-effort only (single-process); enough to blunt
// casual abuse of an unauthenticated endpoint without adding a dependency.
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;
const submissionHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (submissionHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_MAX) {
    submissionHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  submissionHits.set(ip, recent);
  return false;
}

// Public: submit a Circle Builder Program application. No auth required.
router.post(
  "/circle-builder/applications",
  validateBody(createApplicationSchema),
  async (req, res) => {
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)
        ?.split(",")[0]
        ?.trim() ||
      req.ip ||
      "unknown";
    if (isRateLimited(ip)) {
      res.status(429).json({
        error: "Too many applications from this network. Please try again later.",
      });
      return;
    }

    const body = req.body as z.infer<typeof createApplicationSchema>;

    const [application] = await db
      .insert(circleBuilderApplicationsTable)
      .values({
        name: body.name,
        email: body.email,
        location: body.location,
        communityServed: body.communityServed,
        networkSize: body.networkSize,
        motivation: body.motivation,
        desiredImpact: body.desiredImpact,
        willingToHost: body.willingToHost,
      })
      .returning();

    // Notify the team out of band. Best-effort: failures must not block the
    // applicant's success response.
    const adminEmail = process.env["VERIFICATION_ADMIN_EMAIL"];
    if (adminEmail) {
      const summary = [
        `New Circle Builder Program application (id: ${application.id})`,
        "",
        `Name: ${body.name}`,
        `Email: ${body.email}`,
        `City/State: ${body.location}`,
        `Community served: ${body.communityServed}`,
        `Network size: ${body.networkSize}`,
        `Willing to host within 60 days: ${body.willingToHost ? "Yes" : "No"}`,
        "",
        "Why they want to build a circle:",
        body.motivation,
        "",
        "Desired impact:",
        body.desiredImpact,
      ].join("\n");
      const { sendEmail } = await import("../lib/email");
      void sendEmail({
        to: adminEmail,
        subject: `[MyZolve] Circle Builder application: ${body.name}`,
        replyTo: body.email,
        text: summary,
        html: `<pre style="font-family: ui-monospace, monospace; white-space: pre-wrap;">${summary
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</pre>`,
      }).catch((err) => {
        logger.warn({ err }, "Circle Builder application email failed");
      });
    }

    res.status(201).json({ id: application.id });
  },
);

// Admin: list all applications (newest first).
router.get("/circle-builder/applications", requireAuth, async (req, res) => {
  if (!isProgramAdmin(req.dbUser!.email)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const applications = await db
    .select({ application: circleBuilderApplicationsTable, reviewer: usersTable })
    .from(circleBuilderApplicationsTable)
    .leftJoin(
      usersTable,
      eq(circleBuilderApplicationsTable.reviewedByUserId, usersTable.id),
    )
    .orderBy(desc(circleBuilderApplicationsTable.createdAt));

  res.json(
    applications.map((row) =>
      applicationToApi(row.application, row.reviewer?.displayName ?? null),
    ),
  );
});

// Admin: update an application's review status.
router.patch(
  "/circle-builder/applications/:id",
  requireAuth,
  validateParams(applicationIdParam),
  validateBody(reviewApplicationSchema),
  async (req, res) => {
    if (!isProgramAdmin(req.dbUser!.email)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const id = Number(req.params.id);
    const { status, reviewNote } = req.body as z.infer<
      typeof reviewApplicationSchema
    >;

    const [updated] = await db
      .update(circleBuilderApplicationsTable)
      .set({
        status,
        reviewNote: reviewNote ?? null,
        reviewedByUserId: req.dbUser!.id,
        reviewedAt: new Date(),
      })
      .where(eq(circleBuilderApplicationsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    res.json(applicationToApi(updated, req.dbUser!.displayName ?? null));
  },
);

// Admin gate probe for the client: 200 if the caller is a program admin,
// 403 otherwise. Lets the admin page show a clean "not authorized" state.
router.get("/circle-builder/admin-check", requireAuth, async (req, res) => {
  if (!isProgramAdmin(req.dbUser!.email)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json({ ok: true });
});

export default router;
