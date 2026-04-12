import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { circlesTable } from "./circles";

export const disputesTable = pgTable("disputes", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  raisedByUserId: integer("raised_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  targetEntityType: text("target_entity_type").notNull(),
  targetEntityId: integer("target_entity_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  resolvedByUserId: integer("resolved_by_user_id")
    .references(() => usersTable.id),
  resolutionNote: text("resolution_note"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDisputeSchema = createInsertSchema(disputesTable).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true });
export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type Dispute = typeof disputesTable.$inferSelect;
