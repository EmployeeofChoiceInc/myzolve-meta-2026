import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { circlesTable } from "./circles";

export const servicePostsTable = pgTable("service_posts", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  serviceType: text("service_type").notNull().default("offer"),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("other"),
  availability: text("availability"),
  locationMode: text("location_mode").notNull().default("remote"),
  exchangePreference: text("exchange_preference").notNull().default("free"),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("open"),
  visibilityScope: text("visibility_scope").notNull().default("whole_circle"),
  matchedByUserId: integer("matched_by_user_id").references(
    () => usersTable.id,
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertServicePostSchema = createInsertSchema(
  servicePostsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServicePost = z.infer<typeof insertServicePostSchema>;
export type ServicePost = typeof servicePostsTable.$inferSelect;
