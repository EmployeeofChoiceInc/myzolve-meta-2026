import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const circlesTable = pgTable("circles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  circleType: text("circle_type")
    .notNull()
    .default("family"),
  description: text("description"),
  photoUrl: text("photo_url"),
  currency: text("currency").notNull().default("USD"),
  privacyMode: text("privacy_mode").notNull().default("private"),
  ledgerMode: text("ledger_mode").notNull().default("private"),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const circleMembersTable = pgTable("circle_members", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const circleInvitationsTable = pgTable("circle_invitations", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email"),
  invitedByUserId: integer("invited_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  role: text("role").notNull().default("member"),
  customMessage: text("custom_message"),
  status: text("status").notNull().default("pending"),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCircleSchema = createInsertSchema(circlesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCircle = z.infer<typeof insertCircleSchema>;
export type Circle = typeof circlesTable.$inferSelect;

export const insertCircleMemberSchema = createInsertSchema(
  circleMembersTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCircleMember = z.infer<typeof insertCircleMemberSchema>;
export type CircleMember = typeof circleMembersTable.$inferSelect;

export const insertCircleInvitationSchema = createInsertSchema(
  circleInvitationsTable,
).omit({ id: true, createdAt: true });
export type InsertCircleInvitation = z.infer<
  typeof insertCircleInvitationSchema
>;
export type CircleInvitation = typeof circleInvitationsTable.$inferSelect;
