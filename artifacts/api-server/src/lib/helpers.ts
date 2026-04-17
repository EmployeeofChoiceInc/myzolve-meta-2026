import { db } from "@workspace/db";
import { circleMembersTable, usersTable, notificationsTable, auditLogsTable, notificationPreferencesTable } from "@workspace/db";
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

export async function createNotification(params: {
  userId: number;
  circleId?: number;
  notificationType: string;
  title: string;
  body: string;
  targetEntityType?: string;
  targetEntityId?: number;
}) {
  const pref = await db
    .select({ enabled: notificationPreferencesTable.enabled })
    .from(notificationPreferencesTable)
    .where(
      and(
        eq(notificationPreferencesTable.userId, params.userId),
        eq(notificationPreferencesTable.notificationType, params.notificationType),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  if (pref && !pref.enabled) {
    return;
  }

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
