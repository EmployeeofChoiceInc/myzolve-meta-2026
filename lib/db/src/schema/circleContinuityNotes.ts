import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { circlesTable } from "./circles";
import { usersTable } from "./users";

export const circleContinuityNotesTable = pgTable(
  "circle_continuity_notes",
  {
    id: serial("id").primaryKey(),
    circleId: integer("circle_id")
      .notNull()
      .references(() => circlesTable.id, { onDelete: "cascade" }),
    title: text("title"),
    body: text("body").notNull(),
    authorUserId: integer("author_user_id")
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
  (table) => [index("circle_continuity_notes_circle_idx").on(table.circleId)],
);

export const insertCircleContinuityNoteSchema = createInsertSchema(
  circleContinuityNotesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCircleContinuityNote = z.infer<
  typeof insertCircleContinuityNoteSchema
>;
export type CircleContinuityNote = typeof circleContinuityNotesTable.$inferSelect;
