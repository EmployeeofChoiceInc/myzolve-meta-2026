import { db } from "@workspace/db";
import { supportRequestsTable, repaymentPlansTable } from "@workspace/db";
import { and, eq, inArray, lt, lte, gte, isNotNull } from "drizzle-orm";
import { logger } from "./logger";
import { createAuditLog, createNotification } from "./helpers";

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

async function runScheduledChecks(): Promise<void> {
  await expireUrgentRequests();
  await sendRepaymentDueReminders();
}

export function startScheduler(): void {
  runScheduledChecks();
  const interval = setInterval(runScheduledChecks, EXPIRY_CHECK_INTERVAL_MS);
  interval.unref();
  logger.info("Scheduler started (request auto-expiry + repayment_due reminders, interval: 1h)");
}
