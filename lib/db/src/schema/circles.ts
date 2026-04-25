import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
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
  // Plus "Custom circle look" customization — owner-configurable, all
  // optional with graceful fallbacks.
  bannerObjectPath: text("banner_object_path"),
  accentColor: text("accent_color"),
  welcomeMessage: text("welcome_message"),
  // Verified circle badge — Plus owners apply, the team approves out of
  // band via the admin script. Status is plain text for forward compat:
  //   none | pending | verified | rejected
  verificationStatus: text("verification_status").notNull().default("none"),
  verificationAppliedAt: timestamp("verification_applied_at", {
    withTimezone: true,
  }),
  verificationDecisionReason: text("verification_decision_reason"),
  // Stringified JSON of the application payload (legalName, orgType,
  // description, contactEmail, supportingUrl). Mirrors the pattern used
  // by audit_logs.metadata so we don't need a jsonb column.
  verificationMetadata: text("verification_metadata"),
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
  // Plain text for forward compatibility. Known values:
  //   owner | admin | host | treasurer | scribe | member | guest
  // host/treasurer/scribe are Plus sub-roles — see
  // artifacts/api-server/src/lib/permissions.ts for the rules around granting
  // and the capability matrix.
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  // When the member dismissed the one-time custom-look welcome card.
  // Null means they haven't seen / dismissed it yet.
  welcomeDismissedAt: timestamp("welcome_dismissed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("circle_members_circle_user_uniq").on(table.circleId, table.userId),
]);

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

export const circleJoinRequestsTable = pgTable("circle_join_requests", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  note: text("note"),
  status: text("status").notNull().default("pending"),
  reviewedByUserId: integer("reviewed_by_user_id").references(
    () => usersTable.id,
  ),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("circle_join_requests_circle_user_uniq").on(
    table.circleId,
    table.userId,
  ),
]);

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

export const insertCircleJoinRequestSchema = createInsertSchema(
  circleJoinRequestsTable,
).omit({ id: true, createdAt: true });
export type InsertCircleJoinRequest = z.infer<
  typeof insertCircleJoinRequestSchema
>;
export type CircleJoinRequest = typeof circleJoinRequestsTable.$inferSelect;

export const circlePostsTable = pgTable("circle_posts", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  authorUserId: integer("author_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  actingForUserId: integer("acting_for_user_id").references(
    () => usersTable.id,
    { onDelete: "set null" },
  ),
  copilotReview: text("copilot_review"),
  title: text("title"),
  body: text("body").notNull(),
  imageObjectPath: text("image_object_path"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCirclePostSchema = createInsertSchema(circlePostsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCirclePost = z.infer<typeof insertCirclePostSchema>;
export type CirclePost = typeof circlePostsTable.$inferSelect;
