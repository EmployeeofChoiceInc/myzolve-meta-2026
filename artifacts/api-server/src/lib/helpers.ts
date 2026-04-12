import { db } from "@workspace/db";
import { circleMembersTable, usersTable, notificationsTable, auditLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

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
}

export async function createAuditLog(params: {
  circleId?: number;
  actorUserId: number;
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
