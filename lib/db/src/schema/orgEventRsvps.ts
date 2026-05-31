import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { orgEventsTable } from "./orgEvents";

/**
 * Per-member RSVP to a reunion/org event. One row per (event, user); the
 * status is plain text for forward compatibility:
 *   going | maybe | cant
 */
export const orgEventRsvpsTable = pgTable(
  "org_event_rsvps",
  {
    id: serial("id").primaryKey(),
    orgEventId: integer("org_event_id")
      .notNull()
      .references(() => orgEventsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("going"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("org_event_rsvps_event_user_uniq").on(
      table.orgEventId,
      table.userId,
    ),
  ],
);

export const insertOrgEventRsvpSchema = createInsertSchema(
  orgEventRsvpsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgEventRsvp = z.infer<typeof insertOrgEventRsvpSchema>;
export type OrgEventRsvp = typeof orgEventRsvpsTable.$inferSelect;
