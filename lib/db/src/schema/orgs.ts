import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Enterprise "Org" tier — an Organization that sits above personal Circles.
 * One admin (the owner) buys a seat pool via Stripe (web only, to avoid
 * Apple's 30% on B2B seat sales) and invites members. Active org members are
 * treated as Plus while their seat is active — see
 * artifacts/api-server/src/lib/orgEntitlement.ts and the isPlus integration.
 */
export const orgsTable = pgTable("orgs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => usersTable.id),
  // Light branding shown on org-scoped Circle headers and invite cards.
  logoObjectPath: text("logo_object_path"),
  accentColor: text("accent_color"),
  // Reunion Home ("front door") profile. Welcome message shown in the hero,
  // an optional cover image, and the headline date (e.g. the reunion day or an
  // ERG's flagship event) used for the home-page countdown.
  welcomeMessage: text("welcome_message"),
  coverImageObjectPath: text("cover_image_object_path"),
  heroEventDate: timestamp("hero_event_date", { withTimezone: true }),
  // Plan + billing. `plan` is the marketing tier ("reunion" | "erg" | ...),
  // kept as plain text for forward compatibility. `billingType` is
  // "one_time" (Reunion seat pack) or "annual" (ERG subscription).
  plan: text("plan"),
  billingType: text("billing_type"),
  // Number of seats the pool can hold. Members consume a seat while active.
  seatLimit: integer("seat_limit").notNull().default(0),
  // Stripe linkage. Customer + (for annual) subscription. checkoutSessionId
  // ties a freshly-created pending org to the Checkout Session that pays for
  // it, so the webhook can activate the right org.
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  // Lifecycle status. Plain text for forward compat:
  //   pending   — created, awaiting first successful payment
  //   active    — paid, seats live
  //   past_due  — a payment failed; members keep Plus until graceEndsAt
  //   canceled  — subscription ended / one-time refunded; seats inactive
  status: text("status").notNull().default("pending"),
  // For annual plans: end of the current paid period (renewal date).
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: text("cancel_at_period_end"),
  // When a payment fails we enter a grace window; after this members lose Plus.
  graceEndsAt: timestamp("grace_ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const orgMembersTable = pgTable(
  "org_members",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id")
      .notNull()
      .references(() => orgsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // owner | admin | member
    role: text("role").notNull().default("member"),
    // active (seat consumed) | removed (seat freed)
    status: text("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("org_members_org_user_uniq").on(table.orgId, table.userId),
  ],
);

export const orgInvitesTable = pgTable("org_invites", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id")
    .notNull()
    .references(() => orgsTable.id, { onDelete: "cascade" }),
  // Null for shareable-link invites (anyone with the link can accept).
  invitedEmail: text("invited_email"),
  invitedByUserId: integer("invited_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  role: text("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  // pending | accepted | revoked | expired
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedByUserId: integer("accepted_by_user_id").references(
    () => usersTable.id,
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertOrgSchema = createInsertSchema(orgsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrg = z.infer<typeof insertOrgSchema>;
export type Org = typeof orgsTable.$inferSelect;

export const insertOrgMemberSchema = createInsertSchema(orgMembersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrgMember = z.infer<typeof insertOrgMemberSchema>;
export type OrgMember = typeof orgMembersTable.$inferSelect;

export const insertOrgInviteSchema = createInsertSchema(orgInvitesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertOrgInvite = z.infer<typeof insertOrgInviteSchema>;
export type OrgInvite = typeof orgInvitesTable.$inferSelect;
