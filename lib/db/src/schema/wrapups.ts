import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const wrapupsTable = pgTable(
  "wrapups",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    content: jsonb("content").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("wrapups_user_kind_period_uniq").on(
      table.userId,
      table.kind,
      table.periodStart,
    ),
  ],
);

export const insertWrapupSchema = createInsertSchema(wrapupsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWrapup = z.infer<typeof insertWrapupSchema>;
export type Wrapup = typeof wrapupsTable.$inferSelect;
