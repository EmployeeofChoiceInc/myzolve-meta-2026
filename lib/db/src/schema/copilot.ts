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
import { circlesTable } from "./circles";

export const copilotGrantsTable = pgTable(
  "copilot_grants",
  {
    id: serial("id").primaryKey(),
    circleId: integer("circle_id")
      .notNull()
      .references(() => circlesTable.id, { onDelete: "cascade" }),
    grantorUserId: integer("grantor_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    helperUserId: integer("helper_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: integer("revoked_by_user_id").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("copilot_grants_circle_pair_uniq").on(
      table.circleId,
      table.grantorUserId,
      table.helperUserId,
    ),
  ],
);

export const insertCopilotGrantSchema = createInsertSchema(copilotGrantsTable).omit({
  id: true,
  invitedAt: true,
  respondedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCopilotGrant = z.infer<typeof insertCopilotGrantSchema>;
export type CopilotGrant = typeof copilotGrantsTable.$inferSelect;
