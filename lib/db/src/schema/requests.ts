import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { circlesTable } from "./circles";

export const supportRequestsTable = pgTable("support_requests", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description"),
  amountRequested: numeric("amount_requested", {
    precision: 12,
    scale: 2,
  }).notNull(),
  amountFunded: numeric("amount_funded", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  currency: text("currency").notNull().default("USD"),
  requestType: text("request_type").notNull().default("money"),
  visibilityScope: text("visibility_scope").notNull().default("whole_circle"),
  repaymentExpected: boolean("repayment_expected").notNull().default(false),
  repaymentStyle: text("repayment_style").notNull().default("discuss_later"),
  urgencyLevel: text("urgency_level").notNull().default("normal"),
  category: text("category").notNull().default("other"),
  privacyLevel: text("privacy_level").notNull().default("standard"),
  status: text("status").notNull().default("open"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const supportContributionsTable = pgTable("support_contributions", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => supportRequestsTable.id, { onDelete: "cascade" }),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  contributorUserId: integer("contributor_user_id")
    .notNull()
    .references(() => usersTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  contributionType: text("contribution_type").notNull().default("gift"),
  note: text("note"),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("pledged"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const repaymentPlansTable = pgTable("repayment_plans", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => supportRequestsTable.id, { onDelete: "cascade" }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  startDate: timestamp("start_date", { withTimezone: true }),
  frequency: text("frequency").notNull().default("one_time"),
  installmentAmount: numeric("installment_amount", {
    precision: 12,
    scale: 2,
  }),
  numberOfInstallments: integer("number_of_installments"),
  flexibleNotes: text("flexible_notes"),
  nextDueDate: timestamp("next_due_date", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const repaymentsTable = pgTable("repayments", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => supportRequestsTable.id, { onDelete: "cascade" }),
  payerUserId: integer("payer_user_id")
    .notNull()
    .references(() => usersTable.id),
  payeeUserId: integer("payee_user_id").references(() => usersTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  paymentDate: timestamp("payment_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  note: text("note"),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSupportRequestSchema = createInsertSchema(
  supportRequestsTable,
).omit({ id: true, createdAt: true, updatedAt: true, archivedAt: true });
export type InsertSupportRequest = z.infer<typeof insertSupportRequestSchema>;
export type SupportRequest = typeof supportRequestsTable.$inferSelect;

export const insertContributionSchema = createInsertSchema(
  supportContributionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContribution = z.infer<typeof insertContributionSchema>;
export type Contribution = typeof supportContributionsTable.$inferSelect;

export const insertRepaymentPlanSchema = createInsertSchema(
  repaymentPlansTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRepaymentPlan = z.infer<typeof insertRepaymentPlanSchema>;
export type RepaymentPlan = typeof repaymentPlansTable.$inferSelect;

export const insertRepaymentSchema = createInsertSchema(repaymentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRepayment = z.infer<typeof insertRepaymentSchema>;
export type Repayment = typeof repaymentsTable.$inferSelect;
