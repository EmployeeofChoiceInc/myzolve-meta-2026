import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { circlesTable } from "./circles";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  actorUserId: integer("actor_user_id")
    .references(() => usersTable.id),
  action: text("action").notNull(),
  targetEntityType: text("target_entity_type"),
  targetEntityId: integer("target_entity_id"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
