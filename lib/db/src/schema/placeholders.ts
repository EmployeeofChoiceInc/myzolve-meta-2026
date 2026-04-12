import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { circlesTable } from "./circles";

export const placeholderMembersTable = pgTable("placeholder_members", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  addedByUserId: integer("added_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  displayName: text("display_name").notNull(),
  relationship: text("relationship"),
  notes: text("notes"),
  email: text("email"),
  claimedByUserId: integer("claimed_by_user_id")
    .references(() => usersTable.id),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  status: text("status").notNull().default("unlinked"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPlaceholderMemberSchema = createInsertSchema(placeholderMembersTable).omit({ id: true, createdAt: true, updatedAt: true, claimedAt: true });
export type InsertPlaceholderMember = z.infer<typeof insertPlaceholderMemberSchema>;
export type PlaceholderMember = typeof placeholderMembersTable.$inferSelect;
