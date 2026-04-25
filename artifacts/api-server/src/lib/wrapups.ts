import { db } from "@workspace/db";
import {
  circleMembersTable,
  circlesTable,
  commentsTable,
  gratitudeNotesTable,
  reactionsTable,
  supportContributionsTable,
  supportRequestsTable,
  usersTable,
  wrapupsTable,
} from "@workspace/db";
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { logger } from "./logger";
import { createNotification } from "./helpers";

type WrapupKind = "weekly" | "monthly";

export interface WrapupPerson {
  userId: number | null;
  name: string;
  avatarObjectPath: string | null;
}

export interface WrapupMoment {
  kind:
    | "request_fulfilled"
    | "gratitude_received"
    | "gratitude_sent"
    | "top_comment"
    | "reaction_received";
  headline: string;
  detail: string | null;
  circleName: string | null;
  otherPersonName: string | null;
}

export interface WrapupContent {
  greeting: string;
  periodLabel: string;
  supportGiven: number;
  supportReceived: number;
  topMoments: WrapupMoment[];
  exchangedWith: WrapupPerson[];
  prompt: string;
}

const PROMPTS_WEEKLY = [
  "Is there someone you'd like to thank this week?",
  "Pick one person you appreciate and tell them — a sentence is plenty.",
  "Notice someone who's been quiet lately? A small check-in goes a long way.",
  "Who showed up for you this week without being asked?",
  "If a small ask has been on your mind, this is a gentle moment to share it.",
];

const PROMPTS_MONTHLY = [
  "Looking back, who would you most like to thank this month?",
  "What's one small act of care you'd like to repeat next month?",
  "Is there anyone in your circles you haven't heard from in a while?",
  "What's one ask that, looking back, you wish you'd shared sooner?",
  "Pick one person from this month and let them know they made a difference.",
];

function pickPrompt(kind: WrapupKind, seed: number): string {
  const list = kind === "weekly" ? PROMPTS_WEEKLY : PROMPTS_MONTHLY;
  return list[Math.abs(seed) % list.length];
}

function isoDateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * For a given "now" in UTC, returns the most recently-COMPLETED weekly
 * window. Weeks run Sunday 00:00 UTC → Saturday 23:59:59.999 UTC.
 *
 * Wrap-ups are sent on Sunday morning, so once the clock crosses past
 * Sunday 00:00 UTC the previous Sun..Sat window is "ready to wrap".
 */
export function lastCompletedWeeklyWindow(now: Date): {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
} {
  const todayUTC = startOfUTCDay(now);
  const dow = todayUTC.getUTCDay(); // 0 = Sun
  // Most recent past Sunday at 00:00 UTC. If today is Sunday, that's today.
  const lastSunday = new Date(todayUTC);
  lastSunday.setUTCDate(lastSunday.getUTCDate() - dow);
  // Period = the 7 days ending the day BEFORE that Sunday (Sun..Sat).
  const start = new Date(lastSunday);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(lastSunday);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return {
    start,
    end,
    startIso: isoDateUTC(start),
    endIso: isoDateUTC(end),
  };
}

/**
 * For a given "now" in UTC, returns the most recently-COMPLETED monthly
 * window (the previous calendar month, UTC).
 */
export function lastCompletedMonthlyWindow(now: Date): {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
} {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return {
    start,
    end,
    startIso: isoDateUTC(start),
    endIso: isoDateUTC(end),
  };
}

function formatLabel(start: Date, end: Date, kind: WrapupKind): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  if (kind === "monthly") {
    return start.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

interface PersonRef {
  userId: number;
  name: string;
  avatarObjectPath: string | null;
}

async function loadUserMap(ids: number[]): Promise<Map<number, PersonRef>> {
  const out = new Map<number, PersonRef>();
  const unique = Array.from(new Set(ids.filter((n) => Number.isFinite(n))));
  if (unique.length === 0) return out;
  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.displayName,
      avatarObjectPath: usersTable.avatarObjectPath,
    })
    .from(usersTable)
    .where(inArray(usersTable.id, unique));
  for (const r of rows) {
    out.set(r.id, {
      userId: r.id,
      name: r.name,
      avatarObjectPath: r.avatarObjectPath ?? null,
    });
  }
  return out;
}

function parseRecipientIds(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((v) => Number(v))
        .filter((v): v is number => Number.isFinite(v));
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Build a wrap-up content blob for a single user across all of their
 * active circle memberships in the period. Returns `null` if the
 * period was completely silent — we don't want to send a sad,
 * empty recap.
 */
export async function buildWrapupContent(params: {
  userId: number;
  userName: string;
  start: Date;
  end: Date;
  kind: WrapupKind;
}): Promise<WrapupContent | null> {
  const { userId, start, end, kind } = params;

  const memberRows = await db
    .select({ circleId: circleMembersTable.circleId })
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.userId, userId),
        eq(circleMembersTable.status, "active"),
      ),
    );
  const circleIds = memberRows.map((r) => r.circleId);
  if (circleIds.length === 0) return null;

  const circleRows = await db
    .select({ id: circlesTable.id, name: circlesTable.name })
    .from(circlesTable)
    .where(inArray(circlesTable.id, circleIds));
  const circleNames = new Map(circleRows.map((c) => [c.id, c.name]));

  // ── Gathering activity ────────────────────────────────────────────────────
  const [
    contribsByMe,
    requestsFromMe,
    contribsToMyRequests,
    commentsByMe,
    commentsOnMyEntities,
    reactionsByMe,
    gratitudeSent,
    gratitudeRowsAll,
  ] = await Promise.all([
    db
      .select({
        contribution: supportContributionsTable,
        request: supportRequestsTable,
      })
      .from(supportContributionsTable)
      .innerJoin(
        supportRequestsTable,
        eq(supportContributionsTable.requestId, supportRequestsTable.id),
      )
      .where(
        and(
          eq(supportContributionsTable.contributorUserId, userId),
          inArray(supportContributionsTable.circleId, circleIds),
          gte(supportContributionsTable.createdAt, start),
          lte(supportContributionsTable.createdAt, end),
        ),
      ),
    db
      .select()
      .from(supportRequestsTable)
      .where(
        and(
          eq(supportRequestsTable.createdByUserId, userId),
          inArray(supportRequestsTable.circleId, circleIds),
          gte(supportRequestsTable.createdAt, start),
          lte(supportRequestsTable.createdAt, end),
        ),
      ),
    db
      .select({
        contribution: supportContributionsTable,
        request: supportRequestsTable,
      })
      .from(supportContributionsTable)
      .innerJoin(
        supportRequestsTable,
        eq(supportContributionsTable.requestId, supportRequestsTable.id),
      )
      .where(
        and(
          eq(supportRequestsTable.createdByUserId, userId),
          ne(supportContributionsTable.contributorUserId, userId),
          gte(supportContributionsTable.createdAt, start),
          lte(supportContributionsTable.createdAt, end),
        ),
      ),
    db
      .select()
      .from(commentsTable)
      .where(
        and(
          eq(commentsTable.authorUserId, userId),
          inArray(commentsTable.circleId, circleIds),
          gte(commentsTable.createdAt, start),
          lte(commentsTable.createdAt, end),
          eq(commentsTable.status, "active"),
        ),
      ),
    db
      .select()
      .from(commentsTable)
      .where(
        and(
          inArray(commentsTable.circleId, circleIds),
          ne(commentsTable.authorUserId, userId),
          gte(commentsTable.createdAt, start),
          lte(commentsTable.createdAt, end),
          eq(commentsTable.status, "active"),
        ),
      ),
    db
      .select()
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.userId, userId),
          inArray(reactionsTable.circleId, circleIds),
          gte(reactionsTable.createdAt, start),
          lte(reactionsTable.createdAt, end),
        ),
      ),
    db
      .select()
      .from(gratitudeNotesTable)
      .where(
        and(
          eq(gratitudeNotesTable.senderUserId, userId),
          inArray(gratitudeNotesTable.circleId, circleIds),
          gte(gratitudeNotesTable.createdAt, start),
          lte(gratitudeNotesTable.createdAt, end),
        ),
      ),
    db
      .select()
      .from(gratitudeNotesTable)
      .where(
        and(
          inArray(gratitudeNotesTable.circleId, circleIds),
          ne(gratitudeNotesTable.senderUserId, userId),
          gte(gratitudeNotesTable.createdAt, start),
          lte(gratitudeNotesTable.createdAt, end),
        ),
      ),
  ]);

  // Gratitude received: any note whose recipientUserIds includes me.
  const gratitudeReceived = gratitudeRowsAll.filter((g) =>
    parseRecipientIds(g.recipientUserIds).includes(userId),
  );

  // Reactions on my comments / my requests
  const myEntityKeys = new Set<string>();
  for (const r of requestsFromMe)
    myEntityKeys.add(`support_request:${r.id}`);
  for (const c of commentsByMe) myEntityKeys.add(`comment:${c.id}`);

  let reactionsOnMyEntities: { entityType: string; entityId: number; userId: number }[] = [];
  if (myEntityKeys.size > 0) {
    const entityIds = new Set<number>();
    for (const k of myEntityKeys) entityIds.add(Number(k.split(":")[1]));
    const reactionRows = await db
      .select({
        targetEntityType: reactionsTable.targetEntityType,
        targetEntityId: reactionsTable.targetEntityId,
        userId: reactionsTable.userId,
      })
      .from(reactionsTable)
      .where(
        and(
          inArray(reactionsTable.circleId, circleIds),
          ne(reactionsTable.userId, userId),
          gte(reactionsTable.createdAt, start),
          lte(reactionsTable.createdAt, end),
          inArray(reactionsTable.targetEntityId, Array.from(entityIds)),
        ),
      );
    reactionsOnMyEntities = reactionRows
      .filter((r) =>
        myEntityKeys.has(`${r.targetEntityType}:${r.targetEntityId}`),
      )
      .map((r) => ({
        entityType: r.targetEntityType,
        entityId: r.targetEntityId,
        userId: r.userId,
      }));
  }

  // ── Counts (warm, not quantified-self) ───────────────────────────────────
  const supportGiven =
    contribsByMe.length +
    commentsByMe.length +
    reactionsByMe.length +
    gratitudeSent.length;
  const supportReceived =
    contribsToMyRequests.length +
    commentsOnMyEntities.filter((c) => {
      // Only count comments on my own requests/services
      if (c.targetEntityType !== "support_request") return false;
      return requestsFromMe.some((r) => r.id === c.targetEntityId);
    }).length +
    gratitudeReceived.length +
    reactionsOnMyEntities.length;

  if (supportGiven + supportReceived === 0) return null;

  // ── Exchanged with (people you actually exchanged care with) ─────────────
  const exchangedIds = new Set<number>();
  for (const r of contribsByMe) exchangedIds.add(r.request.createdByUserId);
  for (const r of contribsToMyRequests) exchangedIds.add(r.contribution.contributorUserId);
  for (const g of gratitudeSent)
    for (const id of parseRecipientIds(g.recipientUserIds)) exchangedIds.add(id);
  for (const g of gratitudeReceived) exchangedIds.add(g.senderUserId);
  for (const c of commentsOnMyEntities) {
    if (
      c.targetEntityType === "support_request" &&
      requestsFromMe.some((r) => r.id === c.targetEntityId)
    ) {
      exchangedIds.add(c.authorUserId);
    }
  }
  for (const r of reactionsOnMyEntities) exchangedIds.add(r.userId);
  exchangedIds.delete(userId);

  const userMap = await loadUserMap(Array.from(exchangedIds));
  const exchangedWith: WrapupPerson[] = Array.from(exchangedIds)
    .slice(0, 8)
    .map((id) => {
      const u = userMap.get(id);
      return {
        userId: id,
        name: u?.name ?? "A circle member",
        avatarObjectPath: u?.avatarObjectPath ?? null,
      };
    });

  // ── Top moments ──────────────────────────────────────────────────────────
  const moments: WrapupMoment[] = [];

  // 1. Fulfilled requests (your requests that completed during the period)
  for (const req of requestsFromMe) {
    if (req.status === "completed") {
      moments.push({
        kind: "request_fulfilled",
        headline: `Your request "${req.title}" was fulfilled`,
        detail: null,
        circleName: circleNames.get(req.circleId) ?? null,
        otherPersonName: null,
      });
    }
  }

  // 2. Standout gratitude received
  for (const g of gratitudeReceived.slice(0, 2)) {
    const sender = (await loadUserMap([g.senderUserId])).get(g.senderUserId);
    moments.push({
      kind: "gratitude_received",
      headline: sender
        ? `${sender.name} thanked you`
        : "Someone thanked you",
      detail: g.message.length > 140 ? `${g.message.slice(0, 137)}…` : g.message,
      circleName: circleNames.get(g.circleId) ?? null,
      otherPersonName: sender?.name ?? null,
    });
  }

  // 3. Gratitude you sent
  for (const g of gratitudeSent.slice(0, 1)) {
    const recipientIds = parseRecipientIds(g.recipientUserIds);
    const recip = recipientIds.length
      ? (await loadUserMap(recipientIds)).get(recipientIds[0])
      : null;
    moments.push({
      kind: "gratitude_sent",
      headline: recip
        ? `You thanked ${recip.name}`
        : "You sent a thank-you note",
      detail: g.message.length > 140 ? `${g.message.slice(0, 137)}…` : g.message,
      circleName: circleNames.get(g.circleId) ?? null,
      otherPersonName: recip?.name ?? null,
    });
  }

  // 4. A favorite comment (one of your comments that picked up reactions)
  if (commentsByMe.length > 0) {
    const myCommentIds = commentsByMe.map((c) => c.id);
    const reactionsOnMyComments = await db
      .select({
        targetEntityId: reactionsTable.targetEntityId,
      })
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.targetEntityType, "comment"),
          inArray(reactionsTable.targetEntityId, myCommentIds),
          ne(reactionsTable.userId, userId),
          gte(reactionsTable.createdAt, start),
          lte(reactionsTable.createdAt, end),
        ),
      );
    const reactionCounts = new Map<number, number>();
    for (const r of reactionsOnMyComments) {
      reactionCounts.set(
        r.targetEntityId,
        (reactionCounts.get(r.targetEntityId) ?? 0) + 1,
      );
    }
    let topId: number | null = null;
    let topCount = 0;
    for (const [id, count] of reactionCounts) {
      if (count > topCount) {
        topCount = count;
        topId = id;
      }
    }
    if (topId !== null) {
      const topComment = commentsByMe.find((c) => c.id === topId);
      if (topComment) {
        moments.push({
          kind: "top_comment",
          headline: "A note you wrote landed",
          detail:
            topComment.body.length > 140
              ? `${topComment.body.slice(0, 137)}…`
              : topComment.body,
          circleName: circleNames.get(topComment.circleId) ?? null,
          otherPersonName: null,
        });
      }
    }
  }

  const topMoments = moments.slice(0, 3);

  const greeting =
    kind === "weekly"
      ? `${params.userName.split(/\s+/)[0] || "Hi"}, here's your week.`
      : `${params.userName.split(/\s+/)[0] || "Hi"}, here's your month.`;

  return {
    greeting,
    periodLabel: formatLabel(start, end, kind),
    supportGiven,
    supportReceived,
    topMoments,
    exchangedWith,
    prompt: pickPrompt(kind, userId + start.getUTCDate()),
  };
}

/**
 * Insert (or skip) a wrap-up row for the user/period and dispatch the
 * "your week/month is ready" notification + push.
 *
 * Returns the wrap-up id when one was newly created, or null if the
 * period was empty or a wrap-up already exists.
 */
export async function generateWrapupForUser(params: {
  userId: number;
  userName: string;
  kind: WrapupKind;
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
}): Promise<number | null> {
  const existing = await db
    .select({ id: wrapupsTable.id })
    .from(wrapupsTable)
    .where(
      and(
        eq(wrapupsTable.userId, params.userId),
        eq(wrapupsTable.kind, params.kind),
        eq(wrapupsTable.periodStart, params.startIso),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  if (existing) return null;

  const content = await buildWrapupContent({
    userId: params.userId,
    userName: params.userName,
    kind: params.kind,
    start: params.start,
    end: params.end,
  });
  if (!content) return null;

  const inserted = await db
    .insert(wrapupsTable)
    .values({
      userId: params.userId,
      kind: params.kind,
      periodStart: params.startIso,
      periodEnd: params.endIso,
      content,
    })
    .returning({ id: wrapupsTable.id });
  const id = inserted[0]?.id;
  if (!id) return null;

  const prefType = params.kind === "weekly" ? "wrapup_weekly" : "wrapup_monthly";
  const title =
    params.kind === "weekly"
      ? "Your week of care, in 60 seconds"
      : "Your month of care, in 60 seconds";
  const body =
    params.kind === "weekly"
      ? "A short, warm look back at your circles."
      : `A look back at ${content.periodLabel}.`;

  await createNotification({
    userId: params.userId,
    notificationType: prefType,
    title,
    body,
    targetEntityType: "wrapup",
    targetEntityId: id,
  });

  return id;
}

async function listEligibleUsers(): Promise<{ id: number; displayName: string }[]> {
  // Anyone in at least one active circle membership is a candidate.
  const rows = await db
    .selectDistinct({
      id: usersTable.id,
      displayName: usersTable.displayName,
    })
    .from(usersTable)
    .innerJoin(circleMembersTable, eq(circleMembersTable.userId, usersTable.id))
    .where(eq(circleMembersTable.status, "active"));
  return rows;
}

/**
 * Run wrap-up generation for any users who don't yet have a wrap-up
 * for the most-recent completed window of `kind`.
 *
 * Idempotent: existing rows are skipped via the unique index.
 */
export async function generateWrapupsForKind(kind: WrapupKind, now: Date): Promise<void> {
  const window =
    kind === "weekly"
      ? lastCompletedWeeklyWindow(now)
      : lastCompletedMonthlyWindow(now);

  let created = 0;
  let scanned = 0;
  try {
    const users = await listEligibleUsers();
    scanned = users.length;
    for (const u of users) {
      try {
        const id = await generateWrapupForUser({
          userId: u.id,
          userName: u.displayName,
          kind,
          start: window.start,
          end: window.end,
          startIso: window.startIso,
          endIso: window.endIso,
        });
        if (id) created += 1;
      } catch (err) {
        logger.error({ err, userId: u.id, kind }, "wrap-up generation failed for user");
      }
    }
    if (created > 0) {
      logger.info({ created, scanned, kind, window: window.startIso }, "wrap-ups generated");
    }
  } catch (err) {
    logger.error({ err, kind }, "wrap-up batch generation failed");
  }
}

/**
 * Decide whether it's an appropriate moment to generate weekly wrap-ups.
 * Weekly wrap-ups go out Sunday morning UTC — between 06:00 and 18:00.
 * The hourly scheduler will naturally invoke us multiple times in the
 * window; idempotency via the unique index handles dedupe.
 */
export function shouldRunWeekly(now: Date): boolean {
  return now.getUTCDay() === 0;
}

/**
 * Monthly wrap-ups go out on the 1st of the month (UTC).
 */
export function shouldRunMonthly(now: Date): boolean {
  return now.getUTCDate() === 1;
}

export async function runWrapupChecks(now: Date = new Date()): Promise<void> {
  if (shouldRunWeekly(now)) {
    await generateWrapupsForKind("weekly", now);
  }
  if (shouldRunMonthly(now)) {
    await generateWrapupsForKind("monthly", now);
  }
}

// Useful for dev/QA: force a generation regardless of the calendar.
export async function backfillWrapupForUser(params: {
  userId: number;
  kind: WrapupKind;
  now?: Date;
}): Promise<number | null> {
  const now = params.now ?? new Date();
  const window =
    params.kind === "weekly"
      ? lastCompletedWeeklyWindow(now)
      : lastCompletedMonthlyWindow(now);

  const user = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName })
    .from(usersTable)
    .where(eq(usersTable.id, params.userId))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!user) return null;

  return generateWrapupForUser({
    userId: user.id,
    userName: user.displayName,
    kind: params.kind,
    start: window.start,
    end: window.end,
    startIso: window.startIso,
    endIso: window.endIso,
  });
}

