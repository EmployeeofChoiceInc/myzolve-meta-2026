/**
 * Admin script for the verified-circle queue.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx ./src/verifyCircle.ts list
 *   pnpm --filter @workspace/scripts exec tsx ./src/verifyCircle.ts approve <circleId> "<reason>"
 *   pnpm --filter @workspace/scripts exec tsx ./src/verifyCircle.ts reject  <circleId> "<reason>"
 *
 * v1 of the verified circle workflow is intentionally script-driven —
 * see task #53. The script:
 *   - Updates `circles.verification_*` directly in the DB.
 *   - Writes an audit log entry under the actor "system" (NULL actor).
 *   - Notifies the circle owner about the decision via the in-app
 *     notifications table (which also fans out to push).
 */
import {
  db,
  circlesTable,
  usersTable,
  notificationsTable,
  auditLogsTable,
  pool,
} from "@workspace/db";
import { eq } from "drizzle-orm";

type Decision = "approve" | "reject";

async function listPending() {
  const rows = await db
    .select({
      id: circlesTable.id,
      name: circlesTable.name,
      ownerId: circlesTable.ownerId,
      ownerName: usersTable.displayName,
      ownerEmail: usersTable.email,
      appliedAt: circlesTable.verificationAppliedAt,
      metadata: circlesTable.verificationMetadata,
    })
    .from(circlesTable)
    .leftJoin(usersTable, eq(circlesTable.ownerId, usersTable.id))
    .where(eq(circlesTable.verificationStatus, "pending"))
    .orderBy(circlesTable.verificationAppliedAt);

  if (rows.length === 0) {
    console.log("No pending verification applications.");
    return;
  }

  for (const r of rows) {
    const meta = r.metadata ? JSON.parse(r.metadata) : {};
    console.log("─".repeat(60));
    console.log(`Circle #${r.id}: ${r.name}`);
    console.log(`Owner:  ${r.ownerName} <${r.ownerEmail}>`);
    console.log(`Applied: ${r.appliedAt?.toISOString() ?? "?"}`);
    console.log(`Org name: ${meta.legalName ?? ""}`);
    console.log(`Org type: ${meta.orgType ?? ""}`);
    console.log(`Contact:  ${meta.contactEmail ?? ""}`);
    console.log(`URL:      ${meta.supportingUrl ?? "(none)"}`);
    console.log(`Description: ${meta.description ?? ""}`);
  }
  console.log("─".repeat(60));
}

async function decide(decision: Decision, circleId: number, reason: string) {
  const circle = await db
    .select()
    .from(circlesTable)
    .where(eq(circlesTable.id, circleId))
    .limit(1)
    .then((r) => r[0]);

  if (!circle) {
    console.error(`Circle ${circleId} not found.`);
    process.exitCode = 1;
    return;
  }
  if (circle.verificationStatus !== "pending") {
    console.error(
      `Circle ${circleId} is in status "${circle.verificationStatus}", expected "pending".`,
    );
    process.exitCode = 1;
    return;
  }

  const newStatus = decision === "approve" ? "verified" : "rejected";

  const [updated] = await db
    .update(circlesTable)
    .set({
      verificationStatus: newStatus,
      verificationDecisionReason: reason,
    })
    .where(eq(circlesTable.id, circleId))
    .returning();

  // Audit trail. Actor is null because the script runs out of band as
  // the MyZolve team — `auditLogsTable.actor_user_id` is nullable.
  await db.insert(auditLogsTable).values({
    circleId,
    actorUserId: null,
    action:
      decision === "approve"
        ? "circle_verification_approved"
        : "circle_verification_rejected",
    targetEntityType: "circle",
    targetEntityId: circleId,
    metadata: JSON.stringify({ reason }),
  });

  // Notify the owner about the decision. We hit the notifications
  // table directly here (instead of the API helper) because this
  // script only depends on the db package.
  await db.insert(notificationsTable).values({
    userId: updated.ownerId,
    circleId,
    notificationType:
      decision === "approve"
        ? "circle_verified"
        : "circle_verification_rejected",
    title:
      decision === "approve"
        ? "Your circle is now verified"
        : "Your verification application was declined",
    body:
      decision === "approve"
        ? `${updated.name} now shows the Verified badge to all members.`
        : `${updated.name}: ${reason}`,
    targetEntityType: "circle",
    targetEntityId: circleId,
    isRead: false,
  });

  console.log(
    `Circle #${updated.id} (${updated.name}) → ${newStatus}` +
      (reason ? `: ${reason}` : ""),
  );
}

async function main() {
  const [cmd, idArg, ...rest] = process.argv.slice(2);
  const reason = rest.join(" ").trim();

  try {
    if (cmd === "list") {
      await listPending();
      return;
    }

    if (cmd === "approve" || cmd === "reject") {
      const circleId = Number(idArg);
      if (!Number.isInteger(circleId) || circleId <= 0) {
        console.error("Provide a valid numeric circleId.");
        process.exitCode = 1;
        return;
      }
      if (cmd === "reject" && !reason) {
        console.error("Reject requires a reason argument.");
        process.exitCode = 1;
        return;
      }
      await decide(cmd, circleId, reason || "Approved");
      return;
    }

    console.error(
      'Usage: verifyCircle.ts <list | approve <id> "reason" | reject <id> "reason">',
    );
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
