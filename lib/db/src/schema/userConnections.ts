import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Direct, person-to-person "trusted" connection (LinkedIn-style).
 *
 * This is intentionally distinct from the older `circle_connections` table,
 * which models a *circle*-to-*circle* link with permission scopes. A
 * `user_connection` is a private, mutual relationship between two users
 * that lets them message each other, see each other's profile, and (in
 * future) opt into seeing each other's public activity — without needing
 * to share a circle.
 *
 * Pair uniqueness: there can be at most one row per
 * (initiatorUserId, receiverUserId) ordered pair. To check whether two
 * users are connected, the API queries both directions.
 */
export const userConnectionsTable = pgTable(
  "user_connections",
  {
    id: serial("id").primaryKey(),
    initiatorUserId: integer("initiator_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    receiverUserId: integer("receiver_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // pending | accepted | declined
    // "declined" rows are kept so we can detect repeat-spam from the same
    // initiator. To re-open a previously declined request the API resets
    // status back to "pending" and updates the timestamps in place.
    status: text("status").notNull().default("pending"),
    // Optional one-line note from the initiator, e.g. "We met at the
    // school pickup." Helps the receiver decide whether to accept.
    message: text("message"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("user_connections_pair_uniq").on(
      table.initiatorUserId,
      table.receiverUserId,
    ),
  ],
);

/**
 * Per-user blocklist. When a row exists where `blockerUserId === A` and
 * `blockedUserId === B`:
 *   - B can no longer see A's profile (server returns "user_blocked").
 *   - B can no longer send A a message or comment that targets A.
 *   - B can no longer send A a connection request.
 *   - A no longer sees B in user-search results.
 *
 * The check is symmetric in the obvious ways from the *other* side too:
 * the API filters search results so neither party surfaces the other.
 */
export const userBlocksTable = pgTable(
  "user_blocks",
  {
    id: serial("id").primaryKey(),
    blockerUserId: integer("blocker_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    blockedUserId: integer("blocked_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_blocks_pair_uniq").on(
      table.blockerUserId,
      table.blockedUserId,
    ),
  ],
);

export const insertUserConnectionSchema = createInsertSchema(userConnectionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  respondedAt: true,
});
export type InsertUserConnection = z.infer<typeof insertUserConnectionSchema>;
export type UserConnection = typeof userConnectionsTable.$inferSelect;

export const insertUserBlockSchema = createInsertSchema(userBlocksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUserBlock = z.infer<typeof insertUserBlockSchema>;
export type UserBlock = typeof userBlocksTable.$inferSelect;
