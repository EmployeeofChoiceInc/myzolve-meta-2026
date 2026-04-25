import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { circlesTable } from "./circles";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  authorUserId: integer("author_user_id")
    .notNull()
    .references(() => usersTable.id),
  actingForUserId: integer("acting_for_user_id").references(
    () => usersTable.id,
    { onDelete: "set null" },
  ),
  copilotReview: text("copilot_review"),
  targetEntityType: text("target_entity_type").notNull(),
  targetEntityId: integer("target_entity_id").notNull(),
  parentCommentId: integer("parent_comment_id"),
  body: text("body").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const reactionsTable = pgTable("reactions", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  targetEntityType: text("target_entity_type").notNull(),
  targetEntityId: integer("target_entity_id").notNull(),
  reactionType: text("reaction_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("reactions_user_entity_uniq").on(table.circleId, table.userId, table.targetEntityType, table.targetEntityId, table.reactionType),
]);

export const gratitudeNotesTable = pgTable("gratitude_notes", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  senderUserId: integer("sender_user_id")
    .notNull()
    .references(() => usersTable.id),
  actingForUserId: integer("acting_for_user_id").references(
    () => usersTable.id,
    { onDelete: "set null" },
  ),
  copilotReview: text("copilot_review"),
  targetEntityType: text("target_entity_type").notNull(),
  targetEntityId: integer("target_entity_id").notNull(),
  recipientUserIds: text("recipient_user_ids").notNull().default("[]"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;

export const insertReactionSchema = createInsertSchema(reactionsTable).omit({ id: true, createdAt: true });
export type InsertReaction = z.infer<typeof insertReactionSchema>;
export type Reaction = typeof reactionsTable.$inferSelect;

export const insertGratitudeNoteSchema = createInsertSchema(gratitudeNotesTable).omit({ id: true, createdAt: true });
export type InsertGratitudeNote = z.infer<typeof insertGratitudeNoteSchema>;
export type GratitudeNote = typeof gratitudeNotesTable.$inferSelect;
