/**
 * Admin CLI for complimentary access ("comp") grants — the script-driven
 * counterpart to the in-app admin Comps page. A comp gives free Plus to an
 * individual user, or free access to a whole reunion/org, with an optional end
 * date, and can be revoked.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx ./src/comp.ts list
 *   pnpm --filter @workspace/scripts exec tsx ./src/comp.ts grant-user <email> [days] ["reason"]
 *   pnpm --filter @workspace/scripts exec tsx ./src/comp.ts grant-org  (--org <id> | --owner <email>) [days] ["reason"]
 *   pnpm --filter @workspace/scripts exec tsx ./src/comp.ts revoke <compId>
 *
 * Notes:
 *   - `days` omitted (or 0) means an indefinite comp (no end date).
 *   - Admin identity for the *API/UI* is the VERIFICATION_ADMIN_EMAIL allow-list;
 *     this CLI talks to the DB directly and is therefore not gated — running it
 *     is the privilege.
 */
import {
  db,
  compsTable,
  usersTable,
  orgsTable,
  pool,
} from "@workspace/db";
import { and, desc, eq, isNull, gt, or } from "drizzle-orm";

function expiresAtFromDays(days: number | null): Date | null {
  if (days == null || days <= 0) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function compStatus(c: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}): string {
  if (c.revokedAt) return "revoked";
  if (c.expiresAt && c.expiresAt.getTime() <= Date.now()) return "expired";
  return "active";
}

async function list() {
  const rows = await db
    .select()
    .from(compsTable)
    .orderBy(desc(compsTable.createdAt));

  if (rows.length === 0) {
    console.log("No comps granted yet.");
    return;
  }

  for (const c of rows) {
    let target = "";
    if (c.targetType === "user" && c.userId != null) {
      const u = await db
        .select({ email: usersTable.email, name: usersTable.displayName })
        .from(usersTable)
        .where(eq(usersTable.id, c.userId))
        .limit(1)
        .then((r) => r[0]);
      target = `user ${u?.name ?? "?"} <${u?.email ?? "?"}>`;
    } else if (c.targetType === "org" && c.orgId != null) {
      const o = await db
        .select({ name: orgsTable.name })
        .from(orgsTable)
        .where(eq(orgsTable.id, c.orgId))
        .limit(1)
        .then((r) => r[0]);
      target = `org "${o?.name ?? "?"}" (#${c.orgId})`;
    }
    console.log("─".repeat(60));
    console.log(`Comp #${c.id} [${compStatus(c)}] → ${target}`);
    console.log(
      `  Ends:   ${c.expiresAt ? c.expiresAt.toISOString() : "(indefinite)"}`,
    );
    if (c.reason) console.log(`  Reason: ${c.reason}`);
    console.log(`  Created: ${c.createdAt.toISOString()}`);
  }
  console.log("─".repeat(60));
}

async function grantUser(email: string, days: number | null, reason: string) {
  const user = await db
    .select({ id: usersTable.id, name: usersTable.displayName })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!user) {
    console.error(
      `No user found with email ${email}. They must sign in at least once first.`,
    );
    process.exitCode = 1;
    return;
  }

  // Skip if an active user comp already exists.
  const existing = await db
    .select({ id: compsTable.id })
    .from(compsTable)
    .where(
      and(
        eq(compsTable.targetType, "user"),
        eq(compsTable.userId, user.id),
        isNull(compsTable.revokedAt),
        or(isNull(compsTable.expiresAt), gt(compsTable.expiresAt, new Date())),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  if (existing) {
    console.log(
      `User ${email} already has an active comp (#${existing.id}). Revoke it first to change it.`,
    );
    return;
  }

  const [created] = await db
    .insert(compsTable)
    .values({
      targetType: "user",
      userId: user.id,
      expiresAt: expiresAtFromDays(days),
      reason: reason || null,
    })
    .returning();

  console.log(
    `Granted comp #${created!.id} to ${user.name} <${email}> ` +
      (created!.expiresAt
        ? `until ${created!.expiresAt.toISOString()}.`
        : "indefinitely."),
  );
}

async function grantOrg(
  by: { orgId?: number; ownerEmail?: string },
  days: number | null,
  reason: string,
) {
  let org: { id: number; name: string } | null = null;
  if (by.orgId != null) {
    org = await db
      .select({ id: orgsTable.id, name: orgsTable.name })
      .from(orgsTable)
      .where(eq(orgsTable.id, by.orgId))
      .limit(1)
      .then((r) => r[0] ?? null);
  } else if (by.ownerEmail) {
    org = await db
      .select({ id: orgsTable.id, name: orgsTable.name })
      .from(orgsTable)
      .innerJoin(usersTable, eq(usersTable.id, orgsTable.ownerId))
      .where(eq(usersTable.email, by.ownerEmail.toLowerCase()))
      .orderBy(desc(orgsTable.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null);
  }

  if (!org) {
    console.error(
      by.orgId
        ? `No org found with id ${by.orgId}.`
        : `No org found owned by ${by.ownerEmail}.`,
    );
    process.exitCode = 1;
    return;
  }

  const existing = await db
    .select({ id: compsTable.id })
    .from(compsTable)
    .where(
      and(
        eq(compsTable.targetType, "org"),
        eq(compsTable.orgId, org.id),
        isNull(compsTable.revokedAt),
        or(isNull(compsTable.expiresAt), gt(compsTable.expiresAt, new Date())),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  if (existing) {
    console.log(
      `Org "${org.name}" (#${org.id}) already has an active comp (#${existing.id}). Revoke it first to change it.`,
    );
    return;
  }

  const [created] = await db
    .insert(compsTable)
    .values({
      targetType: "org",
      orgId: org.id,
      expiresAt: expiresAtFromDays(days),
      reason: reason || null,
    })
    .returning();

  console.log(
    `Granted comp #${created!.id} to org "${org.name}" (#${org.id}) ` +
      (created!.expiresAt
        ? `until ${created!.expiresAt.toISOString()}.`
        : "indefinitely."),
  );
}

async function revoke(compId: number) {
  const existing = await db
    .select()
    .from(compsTable)
    .where(eq(compsTable.id, compId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!existing) {
    console.error(`Comp #${compId} not found.`);
    process.exitCode = 1;
    return;
  }
  if (existing.revokedAt) {
    console.log(`Comp #${compId} is already revoked.`);
    return;
  }

  await db
    .update(compsTable)
    .set({ revokedAt: new Date() })
    .where(eq(compsTable.id, compId));

  console.log(`Revoked comp #${compId}.`);
}

function parseDaysAndReason(args: string[]): {
  days: number | null;
  reason: string;
} {
  // First arg may be a number of days; the rest is the reason.
  if (args.length === 0) return { days: null, reason: "" };
  const maybeDays = Number(args[0]);
  if (Number.isInteger(maybeDays)) {
    return { days: maybeDays, reason: args.slice(1).join(" ").trim() };
  }
  return { days: null, reason: args.join(" ").trim() };
}

async function main() {
  const argv = process.argv.slice(2);
  const [cmd, ...rest] = argv;

  try {
    if (cmd === "list") {
      await list();
      return;
    }

    if (cmd === "grant-user") {
      const email = rest[0];
      if (!email || !email.includes("@")) {
        console.error("Provide a valid email: grant-user <email> [days] [reason]");
        process.exitCode = 1;
        return;
      }
      const { days, reason } = parseDaysAndReason(rest.slice(1));
      await grantUser(email, days, reason);
      return;
    }

    if (cmd === "grant-org") {
      // Parse --org <id> | --owner <email> then [days] [reason].
      let orgId: number | undefined;
      let ownerEmail: string | undefined;
      const tail: string[] = [];
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === "--org") {
          orgId = Number(rest[++i]);
        } else if (rest[i] === "--owner") {
          ownerEmail = rest[++i];
        } else {
          tail.push(rest[i]!);
        }
      }
      if (orgId == null && !ownerEmail) {
        console.error(
          "Provide a target: grant-org (--org <id> | --owner <email>) [days] [reason]",
        );
        process.exitCode = 1;
        return;
      }
      if (orgId != null && (!Number.isInteger(orgId) || orgId <= 0)) {
        console.error("--org must be a positive integer id.");
        process.exitCode = 1;
        return;
      }
      const { days, reason } = parseDaysAndReason(tail);
      await grantOrg({ orgId, ownerEmail }, days, reason);
      return;
    }

    if (cmd === "revoke") {
      const compId = Number(rest[0]);
      if (!Number.isInteger(compId) || compId <= 0) {
        console.error("Provide a valid numeric compId: revoke <compId>");
        process.exitCode = 1;
        return;
      }
      await revoke(compId);
      return;
    }

    console.error(
      [
        "Usage:",
        "  comp.ts list",
        "  comp.ts grant-user <email> [days] [reason]",
        "  comp.ts grant-org (--org <id> | --owner <email>) [days] [reason]",
        "  comp.ts revoke <compId>",
      ].join("\n"),
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
