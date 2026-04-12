import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validateParams, circleIdParam } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  activityFeedItemsTable,
  ledgerEntriesTable,
  circleMembersTable,
  circlesTable,
  usersTable,
  supportContributionsTable,
  supportRequestsTable,
  repaymentsTable,
  servicePostsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

async function assertCircleMember(circleId: number, userId: number) {
  return db
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
}

router.get("/circles/:circleId/activity", requireAuth, validateParams(circleIdParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));
  const limit = parseInt(String(req.query.limit ?? "20"));
  const offset = parseInt(String(req.query.offset ?? "0"));

  const member = await assertCircleMember(circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const isAdminOrOwner = ["owner", "admin"].includes(member.role);

  const items = await db
    .select({ item: activityFeedItemsTable, actor: usersTable })
    .from(activityFeedItemsTable)
    .leftJoin(usersTable, eq(activityFeedItemsTable.actorUserId, usersTable.id))
    .where(eq(activityFeedItemsTable.circleId, circleId))
    .orderBy(desc(activityFeedItemsTable.createdAt))
    .limit(limit + 50)
    .offset(offset);

  const requestIds = items
    .filter((i) => i.item.targetEntityType === "support_request" && i.item.targetEntityId !== null)
    .map((i) => i.item.targetEntityId as number);

  let restrictedRequestIds = new Set<number>();
  if (requestIds.length > 0 && !isAdminOrOwner) {
    const requests = await db
      .select({ id: supportRequestsTable.id, visibilityScope: supportRequestsTable.visibilityScope, createdByUserId: supportRequestsTable.createdByUserId })
      .from(supportRequestsTable)
      .where(eq(supportRequestsTable.circleId, circleId));
    for (const r of requests) {
      if (
        (r.visibilityScope === "private_draft" || r.visibilityScope === "admins_only") &&
        r.createdByUserId !== userId
      ) {
        restrictedRequestIds.add(r.id);
      }
    }
  }

  const visible = items.filter((i) => {
    if (i.item.targetEntityType === "support_request" && i.item.targetEntityId !== null) {
      return !restrictedRequestIds.has(i.item.targetEntityId);
    }
    return true;
  }).slice(0, limit);

  res.json(
    visible.map((i) => ({
      id: i.item.id,
      circleId: i.item.circleId,
      actorUserId: i.item.actorUserId,
      actorName: i.actor?.displayName ?? "Someone",
      activityType: i.item.activityType,
      targetEntityType: i.item.targetEntityType,
      targetEntityId: i.item.targetEntityId,
      summaryText: i.item.summaryText,
      createdAt: i.item.createdAt,
    })),
  );
});

router.get("/circles/:circleId/ledger", requireAuth, validateParams(circleIdParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));
  const limit = parseInt(String(req.query.limit ?? "50"));
  const offset = parseInt(String(req.query.offset ?? "0"));

  const member = await assertCircleMember(circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const circle = await db
    .select({ ledgerMode: circlesTable.ledgerMode })
    .from(circlesTable)
    .where(eq(circlesTable.id, circleId))
    .limit(1)
    .then((r) => r[0]);

  const isAdminOrOwner = ["owner", "admin"].includes(member.role);
  const ledgerMode = circle?.ledgerMode ?? "private";

  if ((ledgerMode === "private" || ledgerMode === "admin_only") && !isAdminOrOwner) {
    res.status(403).json({ error: "Ledger is not visible to members" });
    return;
  }

  const entries = await db
    .select()
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.circleId, circleId))
    .orderBy(desc(ledgerEntriesTable.date))
    .limit(limit)
    .offset(offset);

  const isSummaryMode = ledgerMode === "summary" && !isAdminOrOwner;

  res.json(
    entries.map((e) => ({
      id: e.id,
      circleId: e.circleId,
      entryKind: e.entryKind,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      giverName: isSummaryMode ? null : e.giverName,
      receiverName: isSummaryMode ? null : e.receiverName,
      amount: e.amount ? parseFloat(e.amount) : null,
      currency: e.currency,
      description: isSummaryMode ? null : e.description,
      date: e.date,
      createdAt: e.createdAt,
    })),
  );
});

router.get(
  "/circles/:circleId/ledger/summary",
  requireAuth,
  async (req, res) => {
    const userId = req.dbUser!.id;
    const circleId = parseInt(String(req.params.circleId));

    const member = await assertCircleMember(circleId, userId);
    if (!member) {
      res.status(404).json({ error: "Circle not found" });
      return;
    }

    const allContributions = await db
      .select()
      .from(supportContributionsTable)
      .innerJoin(
        supportRequestsTable,
        eq(supportContributionsTable.requestId, supportRequestsTable.id),
      )
      .where(
        and(
          eq(supportRequestsTable.circleId, circleId),
          eq(supportContributionsTable.status, "confirmed"),
        ),
      );

    const allRepayments = await db
      .select()
      .from(repaymentsTable)
      .innerJoin(
        supportRequestsTable,
        eq(repaymentsTable.requestId, supportRequestsTable.id),
      )
      .where(
        and(
          eq(supportRequestsTable.circleId, circleId),
          eq(repaymentsTable.status, "completed"),
        ),
      );

    const totalGiven = allContributions
      .filter((c) => c.support_contributions.contributionType !== "gift")
      .reduce((s, c) => s + parseFloat(c.support_contributions.amount), 0);

    const totalReceived = allContributions
      .filter((c) => c.support_requests.createdByUserId === userId)
      .reduce((s, c) => s + parseFloat(c.support_contributions.amount), 0);

    const totalRepaid = allRepayments.reduce(
      (s, r) => s + parseFloat(r.repayments.amount),
      0,
    );

    const totalForgiven = allContributions
      .filter((c) => c.support_contributions.contributionType === "gift")
      .reduce((s, c) => s + parseFloat(c.support_contributions.amount), 0);

    const outstandingBalance = Math.max(0, totalGiven - totalRepaid);

    const myGiven = allContributions
      .filter(
        (c) =>
          c.support_contributions.contributorUserId === userId &&
          c.support_contributions.contributionType !== "gift",
      )
      .reduce((s, c) => s + parseFloat(c.support_contributions.amount), 0);

    const myReceived = allContributions
      .filter((c) => c.support_requests.createdByUserId === userId)
      .reduce((s, c) => s + parseFloat(c.support_contributions.amount), 0);

    const myRepaid = allRepayments
      .filter((r) => r.repayments.payerUserId === userId)
      .reduce((s, r) => s + parseFloat(r.repayments.amount), 0);

    const myOutstanding = Math.max(0, myReceived - myRepaid);

    let softMessage = "Your circle is supporting each other beautifully.";
    if (myOutstanding > 0) {
      softMessage =
        "When the time is right, consider returning some support to your circle.";
    } else if (myGiven > 0) {
      softMessage = "Thank you for your generosity in supporting your circle.";
    }

    res.json({
      circleId,
      totalGiven,
      totalReceived,
      totalRepaid,
      totalForgiven,
      outstandingBalance,
      myGiven,
      myReceived,
      myOutstanding,
      currency: "USD",
      softMessage,
    });
  },
);

router.get("/circles/:circleId/dashboard", requireAuth, validateParams(circleIdParam), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const member = await assertCircleMember(circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const openRequests = await db
    .select()
    .from(supportRequestsTable)
    .where(
      and(
        eq(supportRequestsTable.circleId, circleId),
        eq(supportRequestsTable.status, "open"),
      ),
    );

  const urgentCount = openRequests.filter((r) =>
    ["urgent", "emergency"].includes(r.urgencyLevel),
  ).length;

  const myOpenRequests = openRequests.filter(
    (r) => r.createdByUserId === userId,
  ).length;

  const recentActivityRows = await db
    .select({ item: activityFeedItemsTable, actor: usersTable })
    .from(activityFeedItemsTable)
    .leftJoin(usersTable, eq(activityFeedItemsTable.actorUserId, usersTable.id))
    .where(eq(activityFeedItemsTable.circleId, circleId))
    .orderBy(desc(activityFeedItemsTable.createdAt))
    .limit(5);

  const recentActivity = recentActivityRows.map((i) => ({
    id: i.item.id,
    circleId: i.item.circleId,
    actorUserId: i.item.actorUserId,
    actorName: i.actor?.displayName ?? "Someone",
    activityType: i.item.activityType,
    targetEntityType: i.item.targetEntityType,
    targetEntityId: i.item.targetEntityId,
    summaryText: i.item.summaryText,
    createdAt: i.item.createdAt,
  }));

  const [activeServicesRow] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(servicePostsTable)
    .where(
      and(
        eq(servicePostsTable.circleId, circleId),
        eq(servicePostsTable.status, "open"),
      ),
    );

  const myContributions = await db
    .select()
    .from(supportContributionsTable)
    .innerJoin(
      supportRequestsTable,
      eq(supportContributionsTable.requestId, supportRequestsTable.id),
    )
    .where(
      and(
        eq(supportRequestsTable.circleId, circleId),
        eq(supportRequestsTable.createdByUserId, userId),
        eq(supportContributionsTable.contributionType, "loan"),
        eq(supportContributionsTable.status, "confirmed"),
      ),
    );

  const pendingRepayments = await Promise.all(
    myContributions.map(async (c) => ({
      requestId: c.support_requests.id,
      requestTitle: c.support_requests.title,
      amountOwed: parseFloat(c.support_contributions.amount),
      currency: c.support_contributions.currency,
      dueDate: c.support_requests.dueDate,
      counterpartyName: await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, c.support_contributions.contributorUserId))
        .limit(1)
        .then((r) => r[0]?.displayName ?? "Unknown"),
    })),
  );

  const activityCount = recentActivity.length;
  const circleHealth =
    activityCount === 0 ? "quiet" : activityCount < 3 ? "active" : "busy";

  res.json({
    circleId,
    openRequestsCount: openRequests.length,
    urgentRequestsCount: urgentCount,
    pendingRepayments,
    recentActivity,
    activeServices: Number(activeServicesRow?.cnt ?? 0),
    myOpenRequests,
    circleHealth,
  });
});

export default router;
