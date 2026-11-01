import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { circlesTable } from "./circles";
import { usersTable } from "./users";

export const circleContinuityLocationsTable = pgTable(
  "circle_continuity_locations",
  {
    id: serial("id").primaryKey(),
    circleId: integer("circle_id")
      .notNull()
      .references(() => circlesTable.id, { onDelete: "cascade" }),
    location: text("location").notNull(),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("circle_continuity_locations_circle_idx").on(table.circleId)],
);

export const insertCircleContinuityLocationSchema = createInsertSchema(
  circleContinuityLocationsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCircleContinuityLocation = z.infer<
  typeof insertCircleContinuityLocationSchema
>;
export type CircleContinuityLocation =
  typeof circleContinuityLocationsTable.$inferSelect;
