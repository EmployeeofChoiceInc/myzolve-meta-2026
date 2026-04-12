import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
import { db } from "@workspace/db";
import {
  supportRequestsTable,
  supportContributionsTable,
  repaymentPlansTable,
  repaymentsTable,
  circleMembersTable,
  usersTable,
  activityFeedItemsTable,
  ledgerEntriesTable,
  type SupportRequest,
  type Contribution,
  type Repayment,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";

const router = Router();

const createRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  amountRequested: z.number().positive(),
  currency: z.string().length(3).optional().default("USD"),
  requestType: z.enum(["money", "service", "emergency"]).optional().default("money"),
  visibilityScope: z.enum(["specific_person", "selected_members", "whole_circle", "admins_only", "private_draft"]).optional().default("whole_circle"),
  repaymentExpected: z.boolean().optional().default(false),
  repaymentStyle: z.enum(["one_time", "installments", "flexible", "no_repayment", "gift", "discuss_later"]).optional().default("discuss_later"),
  urgencyLevel: z.enum(["low", "normal", "high", "critical"]).optional().default("normal"),
  category: z.string().max(100).optional().default("other"),
  privacyLevel: z.enum(["standard", "sensitive", "very_sensitive"]).optional().default("standard"),
  dueDate: z.string().datetime().optional(),
});

const createContributionSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).optional().default("USD"),
  contributionType: z.enum(["loan", "gift", "partial_gift"]).optional().default("loan"),
  note: z.string().max(1000).optional(),
  paymentMethod: z.string().optional(),
});

const createRepaymentSchema = z.object({
  requestId: z.number().int().positive(),
  amount: z.number().positive(),
  currency: z.string().length(3).optional().default("USD"),
  paymentDate: z.string().datetime().optional(),
  note: z.string().max(1000).optional(),
  paymentMethod: z.string().optional(),
});

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

async function getUserName(userId: number) {
  return db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((r) => r[0]?.displayName ?? "Unknown");
}

function requestToApi(req: SupportRequest, createdByName: string) {
  return {
    id: req.id,
    circleId: req.circleId,
    createdByUserId: req.createdByUserId,
    createdByName,
    title: req.title,
    description: req.description,
    amountRequested: parseFloat(req.amountRequested),
    amountFunded: parseFloat(req.amountFunded),
    currency: req.currency,
    requestType: req.requestType,
    visibilityScope: req.visibilityScope,
    repaymentExpected: req.repaymentExpected,
    repaymentStyle: req.repaymentStyle,
    urgencyLevel: req.urgencyLevel,
    category: req.category,
    privacyLevel: req.privacyLevel,
    status: req.status,
    dueDate: req.dueDate,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
  };
}

function contributionToApi(c: Contribution, contributorName: string) {
  return {
    id: c.id,
    requestId: c.requestId,
    contributorUserId: c.contributorUserId,
    contributorName,
    amount: parseFloat(c.amount),
    currency: c.currency,
    contributionType: c.contributionType,
    note: c.note,
    paymentMethod: c.paymentMethod,
    status: c.status,
    createdAt: c.createdAt,
  };
}

router.get("/circles/:circleId/requests", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));
  const { status, urgency, category } = req.query;

  const member = await assertCircleMember(circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  let query = db
    .select({ req: supportRequestsTable, user: usersTable })
    .from(supportRequestsTable)
    .innerJoin(usersTable, eq(supportRequestsTable.createdByUserId, usersTable.id))
    .where(eq(supportRequestsTable.circleId, circleId))
    .$dynamic();

  const rows = await query;

  let filtered = rows;
  if (status) {
    filtered = filtered.filter((r) => r.req.status === status);
  }
  if (urgency) {
    filtered = filtered.filter((r) => r.req.urgencyLevel === urgency);
  }
  if (category) {
    filtered = filtered.filter((r) => r.req.category === category);
  }

  res.json(
    filtered.map((r) => requestToApi(r.req, r.user.displayName)),
  );
});

router.post("/circles/:circleId/requests", requireAuth, validateBody(createRequestSchema), async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const member = await assertCircleMember(circleId, userId);
  if (!member) {
    res.status(403).json({ error: "Not a member of this circle" });
    return;
  }

  const {
    title,
    description,
    amountRequested,
    currency = "USD",
    requestType = "money",
    visibilityScope = "whole_circle",
    repaymentExpected = false,
    repaymentStyle = "discuss_later",
    urgencyLevel = "normal",
    category = "other",
    privacyLevel = "standard",
    dueDate,
  } = req.body;

  if (!title || amountRequested === undefined) {
    res.status(400).json({ error: "title and amountRequested are required" });
    return;
  }

  const [supportReq] = await db
    .insert(supportRequestsTable)
    .values({
      circleId,
      createdByUserId: userId,
      title,
      description,
      amountRequested: String(amountRequested),
      currency,
      requestType,
      visibilityScope,
      repaymentExpected,
      repaymentStyle,
      urgencyLevel,
      category,
      privacyLevel,
      status: "open",
      ...(dueDate && { dueDate: new Date(dueDate) }),
    })
    .returning();

  const userName = await getUserName(userId);

  await db.insert(activityFeedItemsTable).values({
    circleId,
    actorUserId: userId,
    activityType: "request_posted",
    targetEntityType: "support_request",
    targetEntityId: supportReq.id,
    summaryText: `${userName} posted a support request: "${title}"`,
  });

  res.status(201).json(requestToApi(supportReq, userName));
});

router.get("/requests/:requestId", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const requestId = parseInt(String(req.params.requestId));

  const [row] = await db
    .select({ req: supportRequestsTable, user: usersTable })
    .from(supportRequestsTable)
    .innerJoin(usersTable, eq(supportRequestsTable.createdByUserId, usersTable.id))
    .where(eq(supportRequestsTable.id, requestId))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const member = await assertCircleMember(row.req.circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const contributionRows = await db
    .select({ c: supportContributionsTable, u: usersTable })
    .from(supportContributionsTable)
    .innerJoin(usersTable, eq(supportContributionsTable.contributorUserId, usersTable.id))
    .where(eq(supportContributionsTable.requestId, requestId));

  const contributions = contributionRows.map((r) =>
    contributionToApi(r.c, r.u.displayName),
  );

  const repaymentPlan = await db
    .select()
    .from(repaymentPlansTable)
    .where(eq(repaymentPlansTable.requestId, requestId))
    .limit(1)
    .then((r) => r[0] ?? null);

  res.json({
    ...requestToApi(row.req, row.user.displayName),
    contributions,
    repaymentPlan: repaymentPlan
      ? {
          ...repaymentPlan,
          totalAmount: parseFloat(repaymentPlan.totalAmount),
          installmentAmount: repaymentPlan.installmentAmount
            ? parseFloat(repaymentPlan.installmentAmount)
            : null,
        }
      : null,
  });
});

router.patch("/requests/:requestId", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const requestId = parseInt(String(req.params.requestId));

  const existing = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.id, requestId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const member = await assertCircleMember(existing.circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  if (existing.createdByUserId !== userId && !["owner", "admin"].includes(member.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { title, description, amountRequested, urgencyLevel, category, status, dueDate, repaymentExpected, repaymentStyle } = req.body;

  const [updated] = await db
    .update(supportRequestsTable)
    .set({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(amountRequested !== undefined && { amountRequested: String(amountRequested) }),
      ...(urgencyLevel !== undefined && { urgencyLevel }),
      ...(category !== undefined && { category }),
      ...(status !== undefined && { status }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(repaymentExpected !== undefined && { repaymentExpected }),
      ...(repaymentStyle !== undefined && { repaymentStyle }),
    })
    .where(eq(supportRequestsTable.id, requestId))
    .returning();

  const userName = await getUserName(updated.createdByUserId);
  res.json(requestToApi(updated, userName));
});

router.post("/requests/:requestId/cancel", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const requestId = parseInt(String(req.params.requestId));

  const existing = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.id, requestId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const member = await assertCircleMember(existing.circleId, userId);
  if (!member || (existing.createdByUserId !== userId && !["owner", "admin"].includes(member.role))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(supportRequestsTable)
    .set({ status: "canceled" })
    .where(eq(supportRequestsTable.id, requestId))
    .returning();

  const userName = await getUserName(updated.createdByUserId);
  res.json(requestToApi(updated, userName));
});

router.post("/requests/:requestId/complete", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const requestId = parseInt(String(req.params.requestId));

  const existing = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.id, requestId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const member = await assertCircleMember(existing.circleId, userId);
  if (!member || (existing.createdByUserId !== userId && !["owner", "admin"].includes(member.role))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(supportRequestsTable)
    .set({ status: "completed" })
    .where(eq(supportRequestsTable.id, requestId))
    .returning();

  const userName = await getUserName(updated.createdByUserId);

  await db.insert(activityFeedItemsTable).values({
    circleId: existing.circleId,
    actorUserId: userId,
    activityType: "request_completed",
    targetEntityType: "support_request",
    targetEntityId: requestId,
    summaryText: `"${existing.title}" has been marked as completed`,
  });

  res.json(requestToApi(updated, userName));
});

router.get("/requests/:requestId/contributions", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const requestId = parseInt(String(req.params.requestId));

  const existing = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.id, requestId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const member = await assertCircleMember(existing.circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const rows = await db
    .select({ c: supportContributionsTable, u: usersTable })
    .from(supportContributionsTable)
    .innerJoin(usersTable, eq(supportContributionsTable.contributorUserId, usersTable.id))
    .where(eq(supportContributionsTable.requestId, requestId));

  res.json(rows.map((r) => contributionToApi(r.c, r.u.displayName)));
});

router.post("/requests/:requestId/contributions", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const requestId = parseInt(String(req.params.requestId));

  const existing = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.id, requestId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const member = await assertCircleMember(existing.circleId, userId);
  if (!member) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const {
    amount,
    currency = "USD",
    contributionType = "gift",
    note,
    paymentMethod,
  } = req.body;

  if (!amount) {
    res.status(400).json({ error: "amount is required" });
    return;
  }

  const [contribution] = await db
    .insert(supportContributionsTable)
    .values({
      requestId,
      circleId: existing.circleId,
      contributorUserId: userId,
      amount: String(amount),
      currency,
      contributionType,
      note,
      paymentMethod,
      status: "pledged",
    })
    .returning();

  await db
    .update(supportRequestsTable)
    .set({
      amountFunded: sql`${supportRequestsTable.amountFunded} + ${String(amount)}`,
    })
    .where(eq(supportRequestsTable.id, requestId));

  const userName = await getUserName(userId);

  await db.insert(activityFeedItemsTable).values({
    circleId: existing.circleId,
    actorUserId: userId,
    activityType: "support_offered",
    targetEntityType: "support_request",
    targetEntityId: requestId,
    summaryText: `${userName} offered support for "${existing.title}"`,
  });

  await db.insert(ledgerEntriesTable).values({
    circleId: existing.circleId,
    entryKind: contributionType === "gift" ? "gift_given" : "money_given",
    sourceType: "contribution",
    sourceId: contribution.id,
    giverUserId: userId,
    giverName: userName,
    receiverUserId: existing.createdByUserId,
    receiverName: await getUserName(existing.createdByUserId),
    amount: String(amount),
    currency,
    description: `${contributionType === "gift" ? "Gift" : "Support"} for "${existing.title}"`,
    date: new Date(),
  });

  res.status(201).json(contributionToApi(contribution, userName));
});

router.post("/requests/:requestId/confirm-receipt", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const requestId = parseInt(String(req.params.requestId));

  const existing = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.id, requestId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  if (existing.createdByUserId !== userId) {
    res.status(403).json({ error: "Only the requester can confirm receipt" });
    return;
  }

  await db
    .update(supportContributionsTable)
    .set({ status: "confirmed" })
    .where(
      and(
        eq(supportContributionsTable.requestId, requestId),
        eq(supportContributionsTable.status, "pledged"),
      ),
    );

  const [updated] = await db
    .update(supportRequestsTable)
    .set({ status: "fully_funded" })
    .where(eq(supportRequestsTable.id, requestId))
    .returning();

  const userName = await getUserName(userId);
  res.json(requestToApi(updated, userName));
});

router.post("/contributions/:contributionId/forgive", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const contributionId = parseInt(String(req.params.contributionId));

  const contribution = await db
    .select()
    .from(supportContributionsTable)
    .where(eq(supportContributionsTable.id, contributionId))
    .limit(1)
    .then((r) => r[0]);

  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  if (contribution.contributorUserId !== userId) {
    res.status(403).json({ error: "Only the contributor can forgive" });
    return;
  }

  const [updated] = await db
    .update(supportContributionsTable)
    .set({ contributionType: "gift", status: "confirmed" })
    .where(eq(supportContributionsTable.id, contributionId))
    .returning();

  const request = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.id, contribution.requestId))
    .limit(1)
    .then((r) => r[0]);

  const userName = await getUserName(userId);

  if (request) {
    await db.insert(ledgerEntriesTable).values({
      circleId: request.circleId,
      entryKind: "amount_forgiven",
      sourceType: "contribution",
      sourceId: contribution.id,
      giverUserId: userId,
      giverName: userName,
      receiverUserId: request.createdByUserId,
      receiverName: await getUserName(request.createdByUserId),
      amount: String(contribution.amount),
      currency: contribution.currency,
      description: `Support for "${request.title}" was forgiven as a gift`,
      date: new Date(),
    });
  }

  res.json(contributionToApi(updated, userName));
});

router.get("/requests/:requestId/repayment-plan", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const requestId = parseInt(String(req.params.requestId));

  const existing = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.id, requestId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const member = await assertCircleMember(existing.circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const plan = await db
    .select()
    .from(repaymentPlansTable)
    .where(eq(repaymentPlansTable.requestId, requestId))
    .limit(1)
    .then((r) => r[0]);

  if (!plan) {
    res.status(404).json({ error: "No repayment plan found" });
    return;
  }

  res.json({
    ...plan,
    totalAmount: parseFloat(plan.totalAmount),
    installmentAmount: plan.installmentAmount
      ? parseFloat(plan.installmentAmount)
      : null,
  });
});

router.post("/requests/:requestId/repayment-plan", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const requestId = parseInt(String(req.params.requestId));

  const existing = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.id, requestId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const member = await assertCircleMember(existing.circleId, userId);
  if (!member) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const {
    totalAmount,
    startDate,
    frequency = "one_time",
    installmentAmount,
    numberOfInstallments,
    flexibleNotes,
    nextDueDate,
  } = req.body;

  if (!totalAmount || !frequency) {
    res.status(400).json({ error: "totalAmount and frequency are required" });
    return;
  }

  const [plan] = await db
    .insert(repaymentPlansTable)
    .values({
      requestId,
      totalAmount: String(totalAmount),
      startDate: startDate ? new Date(startDate) : null,
      frequency,
      installmentAmount: installmentAmount ? String(installmentAmount) : null,
      numberOfInstallments,
      flexibleNotes,
      nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
      status: "active",
    })
    .returning();

  res.status(201).json({
    ...plan,
    totalAmount: parseFloat(plan.totalAmount),
    installmentAmount: plan.installmentAmount
      ? parseFloat(plan.installmentAmount)
      : null,
  });
});

router.post("/repayments", requireAuth, validateBody(createRepaymentSchema), async (req, res) => {
  const userId = req.dbUser!.id;
  const {
    requestId,
    amount,
    currency = "USD",
    paymentDate,
    note,
    paymentMethod,
  } = req.body;

  if (!requestId || !amount) {
    res.status(400).json({ error: "requestId and amount are required" });
    return;
  }

  const existing = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.id, requestId))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const member = await assertCircleMember(existing.circleId, userId);
  if (!member) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (existing.createdByUserId !== userId) {
    res.status(403).json({ error: "Only the person who received support can log a return" });
    return;
  }

  const primaryContribution = await db
    .select()
    .from(supportContributionsTable)
    .where(
      and(
        eq(supportContributionsTable.requestId, requestId),
        eq(supportContributionsTable.status, "confirmed"),
      ),
    )
    .orderBy(desc(supportContributionsTable.amount))
    .limit(1)
    .then((r) => r[0]);

  const [repayment] = await db
    .insert(repaymentsTable)
    .values({
      requestId,
      payerUserId: existing.createdByUserId,
      payeeUserId: primaryContribution?.contributorUserId ?? null,
      amount: String(amount),
      currency,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      note,
      paymentMethod,
      status: "completed",
    })
    .returning();

  const payerName = await getUserName(userId);
  const payeeName = await getUserName(existing.createdByUserId);

  await db.insert(activityFeedItemsTable).values({
    circleId: existing.circleId,
    actorUserId: userId,
    activityType: "repayment_marked",
    targetEntityType: "support_request",
    targetEntityId: requestId,
    summaryText: `${payerName} returned support for "${existing.title}"`,
  });

  await db.insert(ledgerEntriesTable).values({
    circleId: existing.circleId,
    entryKind: "money_repaid",
    sourceType: "repayment",
    sourceId: repayment.id,
    giverUserId: userId,
    giverName: payerName,
    receiverUserId: existing.createdByUserId,
    receiverName: payeeName,
    amount: String(amount),
    currency,
    description: `Returned support for "${existing.title}"`,
    date: new Date(),
  });

  res.status(201).json({
    id: repayment.id,
    requestId: repayment.requestId,
    payerUserId: repayment.payerUserId,
    payerName,
    payeeUserId: repayment.payeeUserId,
    payeeName,
    amount: parseFloat(repayment.amount),
    currency: repayment.currency,
    paymentDate: repayment.paymentDate,
    note: repayment.note,
    paymentMethod: repayment.paymentMethod,
    status: repayment.status,
    createdAt: repayment.createdAt,
  });
});

router.get("/circles/:circleId/repayments", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const circleId = parseInt(String(req.params.circleId));

  const member = await assertCircleMember(circleId, userId);
  if (!member) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  const rows = await db
    .select({
      repayment: repaymentsTable,
      payer: usersTable,
    })
    .from(repaymentsTable)
    .innerJoin(
      supportRequestsTable,
      eq(repaymentsTable.requestId, supportRequestsTable.id),
    )
    .innerJoin(usersTable, eq(repaymentsTable.payerUserId, usersTable.id))
    .where(eq(supportRequestsTable.circleId, circleId));

  const result = await Promise.all(
    rows.map(async (r) => {
      const payeeName = r.repayment.payeeUserId
        ? await getUserName(r.repayment.payeeUserId)
        : null;
      return {
        id: r.repayment.id,
        requestId: r.repayment.requestId,
        payerUserId: r.repayment.payerUserId,
        payerName: r.payer.displayName,
        payeeUserId: r.repayment.payeeUserId,
        payeeName,
        amount: parseFloat(r.repayment.amount),
        currency: r.repayment.currency,
        paymentDate: r.repayment.paymentDate,
        note: r.repayment.note,
        paymentMethod: r.repayment.paymentMethod,
        status: r.repayment.status,
        createdAt: r.repayment.createdAt,
      };
    }),
  );

  res.json(result);
});

router.post("/repayments/:repaymentId/confirm", requireAuth, async (req, res) => {
  const userId = req.dbUser!.id;
  const repaymentId = parseInt(String(req.params.repaymentId));

  const repayment = await db
    .select()
    .from(repaymentsTable)
    .where(eq(repaymentsTable.id, repaymentId))
    .limit(1)
    .then((r) => r[0]);

  if (!repayment) {
    res.status(404).json({ error: "Repayment not found" });
    return;
  }

  if (repayment.payeeUserId !== userId) {
    res.status(403).json({ error: "Only the payee can confirm a repayment" });
    return;
  }

  const [updated] = await db
    .update(repaymentsTable)
    .set({ status: "completed" })
    .where(eq(repaymentsTable.id, repaymentId))
    .returning();

  const payerName = await getUserName(updated.payerUserId);
  const payeeName = updated.payeeUserId ? await getUserName(updated.payeeUserId) : null;

  res.json({
    id: updated.id,
    requestId: updated.requestId,
    payerUserId: updated.payerUserId,
    payerName,
    payeeUserId: updated.payeeUserId,
    payeeName,
    amount: parseFloat(updated.amount),
    currency: updated.currency,
    paymentDate: updated.paymentDate,
    note: updated.note,
    paymentMethod: updated.paymentMethod,
    status: updated.status,
    createdAt: updated.createdAt,
  });
});

export default router;
