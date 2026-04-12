import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { circlesTable } from "./circles";

export const activityFeedItemsTable = pgTable("activity_feed_items", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id),
  actorUserId: integer("actor_user_id").references(() => usersTable.id),
  activityType: text("activity_type").notNull(),
  targetEntityType: text("target_entity_type"),
  targetEntityId: integer("target_entity_id"),
  summaryText: text("summary_text").notNull(),
  privacyScope: text("privacy_scope").notNull().default("whole_circle"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ledgerEntriesTable = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id),
  entryKind: text("entry_kind").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: integer("source_id").notNull(),
  giverUserId: integer("giver_user_id").references(() => usersTable.id),
  giverName: text("giver_name").notNull(),
  receiverUserId: integer("receiver_user_id").references(() => usersTable.id),
  receiverName: text("receiver_name").notNull(),
  amount: text("amount"),
  currency: text("currency"),
  description: text("description").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  visibilityMode: text("visibility_mode").notNull().default("whole_circle"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertActivityFeedItemSchema = createInsertSchema(
  activityFeedItemsTable,
).omit({ id: true, createdAt: true });
export type InsertActivityFeedItem = z.infer<
  typeof insertActivityFeedItemSchema
>;
export type ActivityFeedItem = typeof activityFeedItemsTable.$inferSelect;

export const insertLedgerEntrySchema = createInsertSchema(
  ledgerEntriesTable,
).omit({ id: true, createdAt: true });
export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
