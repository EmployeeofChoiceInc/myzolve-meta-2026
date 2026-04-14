import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const directMessagesTable = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  senderUserId: integer("sender_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  recipientUserId: integer("recipient_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DirectMessage = typeof directMessagesTable.$inferSelect;
