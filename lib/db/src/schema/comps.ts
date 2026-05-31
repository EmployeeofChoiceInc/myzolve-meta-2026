import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { orgsTable } from "./orgs";

/**
 * Complimentary access ("comp") grants issued by a program admin. A comp lets
 * the MyZolve team hand out free Plus without a RevenueCat/Stripe purchase —
 * e.g. to give Founding Ambassadors free accounts for a period, or to activate
 * a Reunion org without payment.
 *
 * A comp targets either:
 *   - a single user (`targetType = "user"`, `userId` set) — that user is
 *     treated as Plus directly; or
 *   - a whole org   (`targetType = "org"`,  `orgId` set)  — the org's seat
 *     pool is treated as live, so all active org members are Plus.
 *
 * A comp is "active" when `revokedAt` is null AND (`expiresAt` is null —
 * meaning indefinite — OR `expiresAt` is in the future). Entitlement wiring
 * lives in artifacts/api-server/src/lib/comps.ts and is consumed by
 * isPlus()/getOrgEntitlement()/getPlusStatus().
 */
export const compsTable = pgTable(
  "comps",
  {
    id: serial("id").primaryKey(),
    // "user" | "org"
    targetType: text("target_type").notNull(),
    // Set when targetType === "user".
    userId: integer("user_id").references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    // Set when targetType === "org".
    orgId: integer("org_id").references(() => orgsTable.id, {
      onDelete: "cascade",
    }),
    // null = indefinite (no expiry). Otherwise the comp lapses at this time.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // Freeform note explaining why the comp was granted.
    reason: text("reason"),
    // The admin user who issued the comp (logical FK, no cascade so the audit
    // trail survives if that admin's row is later anonymized).
    grantedByUserId: integer("granted_by_user_id").references(
      () => usersTable.id,
    ),
    // Set when an admin revokes the comp early. Revoked comps never grant Plus.
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("comps_user_idx").on(table.userId),
    index("comps_org_idx").on(table.orgId),
  ],
);

export const insertCompSchema = createInsertSchema(compsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertComp = z.infer<typeof insertCompSchema>;
export type Comp = typeof compsTable.$inferSelect;
