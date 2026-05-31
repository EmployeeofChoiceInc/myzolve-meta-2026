import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { orgsTable } from "./orgs";

/**
 * Org-wide events shown on the Reunion Home (the reunion day itself plus
 * sub-events like a meet & greet or banquet; for an ERG, sessions/workshops).
 * Distinct from per-circle care dates — these belong to the whole org.
 */
export const orgEventsTable = pgTable(
  "org_events",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id")
      .notNull()
      .references(() => orgsTable.id, { onDelete: "cascade" }),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => usersTable.id),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("org_events_org_idx").on(table.orgId)],
);

export const insertOrgEventSchema = createInsertSchema(orgEventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrgEvent = z.infer<typeof insertOrgEventSchema>;
export type OrgEvent = typeof orgEventsTable.$inferSelect;
