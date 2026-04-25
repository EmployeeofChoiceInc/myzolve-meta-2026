import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { circleMembersTable, circlesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

import { requireAuth } from "../middlewares/requireAuth";
import { requirePlus } from "../middlewares/requirePlus";
import {
  validateBody,
  validateParams,
  validateQuery,
  circleIdParam,
} from "../middlewares/validate";
import { canManageLedger } from "../lib/permissions";
import { createNotification, isNotificationTypeEnabled } from "../lib/helpers";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email";
import {
  aggregateProLedger,
  generateLedgerCsv,
  generateYearRecapPdf,
  listLedgerYears,
  uploadExport,
} from "../lib/ledgerPro";

const router = Router();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const yearQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

const exportBody = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

async function assertVisibleLedger(circleId: number, userId: number) {
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
    .then((r) => r[0] ?? null);
  if (!member) return { error: "not_member" as const };

  const circle = await db
    .select({ ledgerMode: circlesTable.ledgerMode, name: circlesTable.name })
    .from(circlesTable)
    .where(eq(circlesTable.id, circleId))
    .limit(1)
    .then((r) => r[0]);

  const ledgerMode = circle?.ledgerMode ?? "private";
  const isAdminOrOwner = canManageLedger(member.role);
  if ((ledgerMode === "private" || ledgerMode === "admin_only") && !isAdminOrOwner) {
    return { error: "ledger_hidden" as const };
  }
  // In summary mode, non-admins still get aggregates of their own
  // activity but other members' names / details must be redacted —
  // mirrors the existing /circles/:id/ledger contract.
  const isSummaryMode = ledgerMode === "summary" && !isAdminOrOwner;
  return { member, circle, isAdminOrOwner, isSummaryMode };
}

router.get(
  "/circles/:circleId/ledger/pro/years",
  requireAuth,
  requirePlus,
  validateParams(circleIdParam),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));

    const access = await assertVisibleLedger(circleId, userId);
    if ("error" in access) {
      res.status(access.error === "not_member" ? 404 : 403).json({
        error: access.error === "not_member" ? "Circle not found" : "Ledger is not visible to members",
      });
      return;
    }

    const years = await listLedgerYears(
      circleId,
      access.isSummaryMode ? userId : undefined,
    );
    const defaultYear = years[0] ?? new Date().getUTCFullYear();
    res.json({ years, defaultYear });
  },
);

router.get(
  "/circles/:circleId/ledger/pro",
  requireAuth,
  requirePlus,
  validateParams(circleIdParam),
  validateQuery(yearQuery),
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));
    const { year } = req.query as unknown as z.infer<typeof yearQuery>;

    const access = await assertVisibleLedger(circleId, userId);
    if ("error" in access) {
      res.status(access.error === "not_member" ? 404 : 403).json({
        error: access.error === "not_member" ? "Circle not found" : "Ledger is not visible to members",
      });
      return;
    }

    const resolvedYear = year ?? new Date().getUTCFullYear();
    const view = await aggregateProLedger({
      circleId,
      userId,
      year: resolvedYear,
      redactNames: access.isSummaryMode,
    });
    res.json(view);
  },
);

router.post(
  "/circles/:circleId/ledger/export",
  requireAuth,
  requirePlus,
  validateParams(circleIdParam),
  validateBody(exportBody),
  async (req, res) => {
    const user = req.dbUser!;
    const circleId = parseInt(String(req.params.circleId));
    const { year } = req.body as z.infer<typeof exportBody>;

    const access = await assertVisibleLedger(circleId, user.id);
    if ("error" in access) {
      res.status(access.error === "not_member" ? 404 : 403).json({
        error: access.error === "not_member" ? "Circle not found" : "Ledger is not visible to members",
      });
      return;
    }

    try {
      const view = await aggregateProLedger({
        circleId,
        userId: user.id,
        year,
        redactNames: access.isSummaryMode,
      });
      const [pdf, csv] = await Promise.all([
        generateYearRecapPdf({
          view,
          forUserName: user.displayName,
          forUserId: user.id,
          redactNames: access.isSummaryMode,
        }),
        generateLedgerCsv({
          circleId,
          year,
          forUserId: user.id,
          redactNames: access.isSummaryMode,
        }),
      ]);
      const uploaded = await uploadExport({
        circleId,
        year,
        userId: user.id,
        pdf,
        csv,
      });

      // Fan out via existing notification infra (in-app + push + email).
      // All three channels honor the user's `ledger_export_ready` pref.
      const circleName = access.circle?.name ?? "Your circle";
      const subject = `Your ${year} Year of Care recap is ready`;
      const body = `${circleName} — open MyZolve Connect to download the PDF and CSV.`;
      try {
        await createNotification({
          userId: user.id,
          circleId,
          notificationType: "ledger_export_ready",
          title: subject,
          body,
          targetEntityType: "ledger_export",
          targetEntityId: year,
        });
      } catch (notifErr) {
        logger.warn(
          { err: notifErr, circleId, year, userId: user.id },
          "Ledger export ready notification failed",
        );
      }

      try {
        const emailEnabled = await isNotificationTypeEnabled(
          user.id,
          "ledger_export_ready",
        );
        if (emailEnabled && user.email) {
          const html = `
<p>Hi ${escapeHtml(user.displayName)},</p>
<p>Your ${year} Year of Care recap for <strong>${escapeHtml(circleName)}</strong> is ready.</p>
<p>
  <a href="${uploaded.pdfUrl}">Download the PDF</a><br/>
  <a href="${uploaded.csvUrl}">Download the CSV</a>
</p>
<p>These links expire in about 24 hours. You can always regenerate them from the
ledger screen in MyZolve Connect.</p>
<p>— MyZolve Connect</p>`.trim();
          const text = `Hi ${user.displayName},

Your ${year} Year of Care recap for ${circleName} is ready.

PDF: ${uploaded.pdfUrl}
CSV: ${uploaded.csvUrl}

These links expire in about 24 hours. You can regenerate them from the ledger screen in MyZolve Connect.

— MyZolve Connect`;
          await sendEmail({
            to: user.email,
            subject,
            html,
            text,
          });
        }
      } catch (emailErr) {
        logger.warn(
          { err: emailErr, circleId, year, userId: user.id },
          "Ledger export email send failed",
        );
      }

      res.json({
        circleId,
        year,
        pdfUrl: uploaded.pdfUrl,
        csvUrl: uploaded.csvUrl,
        expiresAt: uploaded.expiresAt,
      });
    } catch (err) {
      logger.error({ err, circleId, year, userId: user.id }, "Ledger export failed");
      res.status(500).json({ error: "Could not generate export. Please try again." });
    }
  },
);

export default router;
