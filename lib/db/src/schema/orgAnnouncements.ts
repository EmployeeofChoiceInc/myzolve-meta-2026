import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { orgsTable } from "./orgs";

/**
 * Organizer broadcasts shown on the Reunion Home. Posted by org owners/admins
 * and read by every member — the authoritative "from the organizers" channel
 * (e.g. "Hotel block closes Friday", an ERG's leadership update).
 */
export const orgAnnouncementsTable = pgTable(
  "org_announcements",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id")
      .notNull()
      .references(() => orgsTable.id, { onDelete: "cascade" }),
    authorUserId: integer("author_user_id")
      .notNull()
      .references(() => usersTable.id),
    title: text("title"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("org_announcements_org_idx").on(table.orgId)],
);

export const insertOrgAnnouncementSchema = createInsertSchema(
  orgAnnouncementsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrgAnnouncement = z.infer<typeof insertOrgAnnouncementSchema>;
export type OrgAnnouncement = typeof orgAnnouncementsTable.$inferSelect;
