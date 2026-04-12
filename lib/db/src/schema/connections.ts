import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { circlesTable } from "./circles";

export const circleConnectionsTable = pgTable("circle_connections", {
  id: serial("id").primaryKey(),
  initiatorCircleId: integer("initiator_circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  receiverCircleId: integer("receiver_circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  initiatedByUserId: integer("initiated_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  permissionScope: text("permission_scope").notNull().default("service_only"),
  status: text("status").notNull().default("pending"),
  token: text("token").notNull(),
  message: text("message"),
  respondedByUserId: integer("responded_by_user_id")
    .references(() => usersTable.id),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCircleConnectionSchema = createInsertSchema(circleConnectionsTable).omit({ id: true, createdAt: true, updatedAt: true, respondedAt: true });
export type InsertCircleConnection = z.infer<typeof insertCircleConnectionSchema>;
export type CircleConnection = typeof circleConnectionsTable.$inferSelect;
