import { db } from "@workspace/db";
import {
  supportRequestsTable,
  repaymentPlansTable,
  careDatesTable,
  circleMembersTable,
  circlesTable,
  usersTable,
} from "@workspace/db";
import { and, eq, inArray, lt, lte, gte, isNotNull } from "drizzle-orm";
import { logger } from "./logger";
import { createAuditLog, createNotification } from "./helpers";
import { nextOccurrenceFor } from "../routes/careDates";
import { runWrapupChecks } from "./wrapups";

const EXPIRY_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function expireUrgentRequests(): Promise<void> {
  try {
    const now = new Date();

    const expired = await db
      .update(supportRequestsTable)
      .set({ status: "archived" })
      .where(
        and(
          inArray(supportRequestsTable.status, ["open", "partially_funded"]),
          inArray(supportRequestsTable.urgencyLevel, ["emergency", "urgent"]),
          isNotNull(supportRequestsTable.dueDate),
          lt(supportRequestsTable.dueDate, now),
        ),
      )
      .returning({ id: supportRequestsTable.id, circleId: supportRequestsTable.circleId });

    for (const req of expired) {
      await createAuditLog({
        actorUserId: null,
        circleId: req.circleId,
        action: "request_auto_expired",
        targetEntityType: "support_request",
        targetEntityId: req.id,
        metadata: { reason: "Emergency/urgent request passed due date without full funding", autoExpired: true },
      });
    }

    if (expired.length > 0) {
      logger.info({ count: expired.length }, "Auto-expired urgent requests past due date");
    }
  } catch (err) {
    logger.error({ err }, "Error during urgent request auto-expiry check");
  }
}

async function sendRepaymentDueReminders(): Promise<void> {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 h ahead

    const duePlans = await db
      .select({
        planId: repaymentPlansTable.id,
        requestId: repaymentPlansTable.requestId,
        nextDueDate: repaymentPlansTable.nextDueDate,
        totalAmount: repaymentPlansTable.totalAmount,
        installmentAmount: repaymentPlansTable.installmentAmount,
        circleId: supportRequestsTable.circleId,
        createdByUserId: supportRequestsTable.createdByUserId,
      })
      .from(repaymentPlansTable)
      .innerJoin(supportRequestsTable, eq(repaymentPlansTable.requestId, supportRequestsTable.id))
      .where(
        and(
          eq(repaymentPlansTable.status, "active"),
          isNotNull(repaymentPlansTable.nextDueDate),
          gte(repaymentPlansTable.nextDueDate, now),
          lte(repaymentPlansTable.nextDueDate, windowEnd),
        ),
      );

    for (const plan of duePlans) {
      const amount = plan.installmentAmount ?? plan.totalAmount;
      const dueDateStr = plan.nextDueDate
        ? new Date(plan.nextDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "soon";

      await createNotification({
        userId: plan.createdByUserId,
        circleId: plan.circleId,
        notificationType: "repayment_due",
        title: "A repayment is coming up",
        body: `Your repayment of $${Number(amount).toFixed(2)} is due ${dueDateStr}. Return what you can when you can.`,
        targetEntityType: "support_request",
        targetEntityId: plan.requestId,
      });
    }

    if (duePlans.length > 0) {
      logger.info({ count: duePlans.length }, "Sent repayment_due reminders");
    }
  } catch (err) {
    logger.error({ err }, "Error during repayment due reminder check");
  }
}

function todayIsoUTC(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function tomorrowIsoUTC(): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + 1);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const KIND_LEAD: Record<string, string> = {
  birthday: "birthday",
  anniversary: "anniversary",
  memorial: "remembrance day",
  appointment: "appointment",
  other: "important day",
};

async function sendCareCalendarReminders(): Promise<void> {
  try {
    const today = todayIsoUTC();
    const tomorrow = tomorrowIsoUTC();

    const rows = await db
      .select({
        d: careDatesTable,
        circle: circlesTable,
        target: usersTable,
      })
      .from(careDatesTable)
      .innerJoin(circlesTable, eq(careDatesTable.circleId, circlesTable.id))
      .leftJoin(usersTable, eq(careDatesTable.targetUserId, usersTable.id));

    const dueByCircle = new Map<number, { id: number; occurrence: string; entry: typeof rows[number] }[]>();
    for (const r of rows) {
      const occurrence = nextOccurrenceFor(r.d.eventDate, r.d.isAnnual, today);
      if (occurrence !== tomorrow) continue;
      if (r.d.lastRemindedFor === occurrence) continue;
      const list = dueByCircle.get(r.d.circleId) ?? [];
      list.push({ id: r.d.id, occurrence, entry: r });
      dueByCircle.set(r.d.circleId, list);
    }

    if (dueByCircle.size === 0) return;

    let sent = 0;
    for (const [circleId, entries] of dueByCircle) {
      // Members to remind: everyone in the circle except the target user
      // themselves (it would be odd to remind you about your own birthday).
      const members = await db
        .select({ userId: circleMembersTable.userId })
        .from(circleMembersTable)
        .where(
          and(
            eq(circleMembersTable.circleId, circleId),
            eq(circleMembersTable.status, "active"),
            isNotNull(circleMembersTable.userId),
          ),
        );

      for (const e of entries) {
        const targetUserId = e.entry.d.targetUserId;
        const recipients = members
          .map((m) => m.userId!)
          .filter((uid) => uid !== targetUserId);

        const targetName = e.entry.target?.displayName ?? null;
        const lead = KIND_LEAD[e.entry.d.kind] ?? "important day";
        const title = targetName
          ? `${targetName}'s ${lead} is tomorrow`
          : `${e.entry.d.name} is tomorrow`;
        const body = targetName
          ? `In ${e.entry.circle.name}: send ${targetName} a note for "${e.entry.d.name}".`
          : `In ${e.entry.circle.name}: "${e.entry.d.name}" is tomorrow.`;

        for (const userId of recipients) {
          await createNotification({
            userId,
            circleId,
            notificationType: "care_calendar_reminder",
            title,
            body,
            targetEntityType: "care_date",
            targetEntityId: e.id,
          });
        }

        await db
          .update(careDatesTable)
          .set({ lastRemindedFor: e.occurrence })
          .where(eq(careDatesTable.id, e.id));
        sent += recipients.length;
      }
    }

    if (sent > 0) {
      logger.info({ sent }, "Sent care_calendar_reminder notifications");
    }
  } catch (err) {
    logger.error({ err }, "Error during care calendar reminder check");
  }
}

async function runScheduledChecks(): Promise<void> {
  await expireUrgentRequests();
  await sendRepaymentDueReminders();
  await sendCareCalendarReminders();
  await runWrapupChecks(new Date());
}

export function startScheduler(): void {
  runScheduledChecks();
  const interval = setInterval(runScheduledChecks, EXPIRY_CHECK_INTERVAL_MS);
  interval.unref();
  logger.info(
    "Scheduler started (request auto-expiry + repayment_due + care calendar reminders + wrap-ups, interval: 1h)",
  );
}
