import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const memberResourcesTable = pgTable(
  "member_resources",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("member_resources_user_idx").on(table.userId)],
);

export const insertMemberResourceSchema = createInsertSchema(
  memberResourcesTable,
).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMemberResource = z.infer<typeof insertMemberResourceSchema>;
export type MemberResource = typeof memberResourcesTable.$inferSelect;
