import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Applications to the "100 Circle Initiative" / Circle Builder Program.
 *
 * This is a public recruitment funnel: anyone (signed-out included) can
 * submit the 8-question application from the marketing page. The MyZolve
 * team reviews submissions in the in-app admin page and is also emailed a
 * copy on submit. Review status is plain text for forward compatibility:
 *   pending | approved | declined
 */
export const circleBuilderApplicationsTable = pgTable(
  "circle_builder_applications",
  {
    id: serial("id").primaryKey(),
    // Q1–Q3: identity & location.
    name: text("name").notNull(),
    email: text("email").notNull(),
    location: text("location").notNull(),
    // Q4: "What community do you currently serve?"
    communityServed: text("community_served").notNull(),
    // Q5: "Approximately how many people are in your network?" — stored as
    // free text so ranges ("around 50", "100+") are preserved as entered.
    networkSize: text("network_size").notNull(),
    // Q6: "Why do you want to build a MyZolve Connect Circle?"
    motivation: text("motivation").notNull(),
    // Q7: "What impact would you like your circle to have?"
    desiredImpact: text("desired_impact").notNull(),
    // Q8: "Are you willing to host one community gathering within 60 days?"
    willingToHost: boolean("willing_to_host").notNull(),
    // Review workflow.
    status: text("status").notNull().default("pending"),
    reviewedByUserId: integer("reviewed_by_user_id").references(
      () => usersTable.id,
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const insertCircleBuilderApplicationSchema = createInsertSchema(
  circleBuilderApplicationsTable,
).omit({
  id: true,
  status: true,
  reviewedByUserId: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCircleBuilderApplication = z.infer<
  typeof insertCircleBuilderApplicationSchema
>;
export type CircleBuilderApplication =
  typeof circleBuilderApplicationsTable.$inferSelect;
