import { pgTable, text, serial, timestamp, integer, boolean, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { circlesTable } from "./circles";

export const careDatesTable = pgTable(
  "care_dates",
  {
    id: serial("id").primaryKey(),
    circleId: integer("circle_id")
      .notNull()
      .references(() => circlesTable.id, { onDelete: "cascade" }),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => usersTable.id),
    targetUserId: integer("target_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    kind: text("kind").notNull().default("other"),
    note: text("note"),
    isAnnual: boolean("is_annual").notNull().default(false),
    lastRemindedFor: date("last_reminded_for", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("care_dates_circle_idx").on(table.circleId)],
);

export const insertCareDateSchema = createInsertSchema(careDatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRemindedFor: true,
});
export type InsertCareDate = z.infer<typeof insertCareDateSchema>;
export type CareDate = typeof careDatesTable.$inferSelect;
