import { db } from "@workspace/db";
import { supportRequestsTable } from "@workspace/db";
import { and, eq, inArray, lt, isNotNull } from "drizzle-orm";
import { logger } from "./logger";
import { createAuditLog } from "./helpers";

const EXPIRY_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function expireUrgentRequests(): Promise<void> {
  try {
    const now = new Date();

    const expired = await db
      .update(supportRequestsTable)
      .set({ status: "expired" })
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

export function startScheduler(): void {
  expireUrgentRequests();
  const interval = setInterval(expireUrgentRequests, EXPIRY_CHECK_INTERVAL_MS);
  interval.unref();
  logger.info("Request auto-expiry scheduler started (interval: 1h)");
}
