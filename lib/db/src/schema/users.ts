import { pgTable, text, serial, timestamp, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull(),
  timezone: text("timezone"),
  bio: text("bio"),
  location: text("location"),
  // Optional, freeform pronouns ("she/her", "they/them", etc.). Visible on
  // the public profile when set.
  pronouns: text("pronouns"),
  // Optional self-entered phone number. Stored as the user typed it; we do
  // not validate or normalize beyond stripping leading/trailing whitespace.
  // Only ever exposed to other users when `phoneDiscoverable` is true AND
  // the searcher provided an exact match.
  phone: text("phone"),
  // When true, the phone number can be used as an exact-match search key.
  // Defaulted to false so existing rows are forward-compatible (opt-in).
  phoneDiscoverable: boolean("phone_discoverable").notNull().default(false),
  // Default for new circle memberships' `showOnProfile` flag. Acts as the
  // "show all my circles on my public profile" master toggle in Settings.
  // Defaulted to true to preserve existing behavior (circles were shown).
  profileShowCirclesDefault: boolean("profile_show_circles_default")
    .notNull()
    .default(true),
  avatarObjectPath: text("avatar_object_path"),
  // Plus plan kind: "solo" gives the entitlement only to this user;
  // "family" extends derived Plus to up to 6 members of `familyCircleId`.
  // Defaulted to "solo" so existing rows are forward-compatible.
  planKind: text("plan_kind").notNull().default("solo"),
  // Logical FK to circles(id) — kept without a DB-level FK to avoid a
  // circular import between users.ts and circles.ts. Validated server-side
  // (caller must own the circle). Cleared when the circle is deleted via
  // explicit cleanup (see `clearFamilyCircleReferences` on circle delete).
  familyCircleId: integer("family_circle_id"),
  // Snapshot of the last time RevenueCat reported this user's `plus`
  // entitlement as active. Used to give family-plan recipients a 7-day
  // grace window after the subscriber's entitlement lapses.
  subscriptionLastActiveAt: timestamp("subscription_last_active_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
