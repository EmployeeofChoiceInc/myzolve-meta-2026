import { db } from "@workspace/db";
import { circleMembersTable, usersTable, notificationsTable, auditLogsTable, notificationPreferencesTable, copilotGrantsTable } from "@workspace/db";
import { eq, and, inArray, ne } from "drizzle-orm";
import { dispatchPushToUser } from "./pushNotifications";

export async function assertCircleMember(circleId: number, userId: number) {
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

export async function getUserName(userId: number): Promise<string> {
  const user = await db
    .select({ displayName: usersTable.displayName })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((r) => r[0]);
  return user?.displayName ?? "Someone";
}

export async function isNotificationTypeEnabled(
  userId: number,
  notificationType: string,
): Promise<boolean> {
  const pref = await db
    .select({ enabled: notificationPreferencesTable.enabled })
    .from(notificationPreferencesTable)
    .where(
      and(
        eq(notificationPreferencesTable.userId, userId),
        eq(notificationPreferencesTable.notificationType, notificationType),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  // Default to enabled when no row exists — matches createNotification.
  return pref ? pref.enabled : true;
}

export async function createNotification(params: {
  userId: number;
  circleId?: number;
  notificationType: string;
  title: string;
  body: string;
  targetEntityType?: string;
  targetEntityId?: number;
}) {
  const enabled = await isNotificationTypeEnabled(
    params.userId,
    params.notificationType,
  );
  if (!enabled) return;

  await db.insert(notificationsTable).values({
    userId: params.userId,
    circleId: params.circleId ?? null,
    notificationType: params.notificationType,
    title: params.title,
    body: params.body,
    targetEntityType: params.targetEntityType ?? null,
    targetEntityId: params.targetEntityId ?? null,
    isRead: false,
  });

  void dispatchPushToUser(params.userId, {
    title: params.title,
    body: params.body,
    data: {
      notificationType: params.notificationType,
      circleId: params.circleId ?? null,
      targetEntityType: params.targetEntityType ?? null,
      targetEntityId: params.targetEntityId ?? null,
    },
  });
}

/**
 * Parses @mentions in `body` and notifies any active circle members whose
 * displayName starts with the matched token (case-insensitive).
 * Skips users in `excludeUserIds` (e.g. the actor and the post owner who
 * already received a notification for the same event).
 */
export async function notifyMentions(params: {
  circleId: number;
  body: string;
  actorUserId: number;
  actorName: string;
  targetEntityType: string;
  targetEntityId: number;
  excludeUserIds?: number[];
  context?: string;
}) {
  const tokens = Array.from(
    new Set(
      Array.from(params.body.matchAll(/(?<![\w])@([a-zA-Z][a-zA-Z0-9_]{1,30})/g)).map((m) =>
        m[1].toLowerCase(),
      ),
    ),
  );
  if (tokens.length === 0) return;

  const memberRows = await db
    .select({ userId: circleMembersTable.userId, displayName: usersTable.displayName })
    .from(circleMembersTable)
    .innerJoin(usersTable, eq(circleMembersTable.userId, usersTable.id))
    .where(
      and(
        eq(circleMembersTable.circleId, params.circleId),
        eq(circleMembersTable.status, "active"),
        ne(circleMembersTable.userId, params.actorUserId),
      ),
    );

  const exclude = new Set(params.excludeUserIds ?? []);
  exclude.add(params.actorUserId);
  const notified = new Set<number>();

  for (const m of memberRows) {
    const targetUserId = m.userId;
    if (targetUserId === null) continue;
    if (!m.displayName || exclude.has(targetUserId) || notified.has(targetUserId)) continue;
    const handle = m.displayName.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (!handle) continue;
    if (tokens.includes(handle)) {
      notified.add(targetUserId);
      await createNotification({
        userId: targetUserId,
        circleId: params.circleId,
        notificationType: "mention_received",
        title: `${params.actorName} mentioned you${params.context ? ` ${params.context}` : ""}`,
        body: params.body.slice(0, 140) + (params.body.length > 140 ? "…" : ""),
        targetEntityType: params.targetEntityType,
        targetEntityId: params.targetEntityId,
      });
    }
  }
}

/**
 * Returns an active co-pilot grant for the given (circle, helper -> grantor) pair,
 * or null when no such active grant exists. Used to authorize "acting for" actions.
 */
export async function getActiveCopilotGrant(params: {
  circleId: number;
  helperUserId: number;
  grantorUserId: number;
}) {
  return db
    .select()
    .from(copilotGrantsTable)
    .where(
      and(
        eq(copilotGrantsTable.circleId, params.circleId),
        eq(copilotGrantsTable.helperUserId, params.helperUserId),
        eq(copilotGrantsTable.grantorUserId, params.grantorUserId),
        eq(copilotGrantsTable.status, "active"),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
}

/**
 * Validates an incoming actingForUserId on a create call and returns the
 * resolved IDs and grantor display name. Throws an Error with a friendly
 * message when the request is not allowed.
 */
export async function resolveActingFor(params: {
  circleId: number;
  helperUserId: number;
  actingForUserId: number;
}): Promise<{ actingForUserId: number; actingForName: string } | null> {
  if (!params.actingForUserId) return null;
  if (params.actingForUserId === params.helperUserId) {
    throw new Error("You cannot act on behalf of yourself");
  }
  const grantorMember = await assertCircleMember(params.circleId, params.actingForUserId);
  if (!grantorMember) {
    throw new Error("The represented member is not part of this circle");
  }
  const grant = await getActiveCopilotGrant({
    circleId: params.circleId,
    helperUserId: params.helperUserId,
    grantorUserId: params.actingForUserId,
  });
  if (!grant) {
    throw new Error("You do not have an active co-pilot grant for this member in this circle");
  }
  const actingForName = await getUserName(params.actingForUserId);
  return { actingForUserId: params.actingForUserId, actingForName };
}

export async function createAuditLog(params: {
  circleId?: number;
  actorUserId: number | null;
  action: string;
  targetEntityType?: string;
  targetEntityId?: number;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogsTable).values({
    circleId: params.circleId ?? null,
    actorUserId: params.actorUserId,
    action: params.action,
    targetEntityType: params.targetEntityType ?? null,
    targetEntityId: params.targetEntityId ?? null,
    metadata: JSON.stringify(params.metadata ?? {}),
  });
}
