import { pgTable, serial, integer, numeric, text, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const loansTable = pgTable("loans", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  agencyId: integer("agency_id").notNull(),
  promoterId: integer("promoter_id").notNull(),
  originalCapital: numeric("original_capital", { precision: 12, scale: 2 }).notNull(),
  currentCapital: numeric("current_capital", { precision: 12, scale: 2 }).notNull(),
  rate: numeric("rate", { precision: 5, scale: 4 }).notNull().default("0.10"),
  periodicity: text("periodicity").notNull().default("biweekly"), // daily, weekly, biweekly, monthly
  status: text("status").notNull().default("pending_approval"),
  // statuses: pending_approval, approved, pending_disbursement, active, rejected, settled
  overdueInterest: numeric("overdue_interest", { precision: 12, scale: 2 }).notNull().default("0"),
  currentInterest: numeric("current_interest", { precision: 12, scale: 2 }).notNull().default("0"),
  disbursementDate: date("disbursement_date"),
  nextCutDate: date("next_cut_date"),
  lastInterestDate: date("last_interest_date"),
  disbursementMethod: text("disbursement_method"),
  disbursementProof: text("disbursement_proof"),
  inDefault: boolean("in_default").notNull().default(false),
  portfolioCommissionRate: numeric("portfolio_commission_rate", { precision: 5, scale: 4 }).notNull().default("0"),
  rejectReason: text("reject_reason"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLoanSchema = createInsertSchema(loansTable).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loansTable.$inferSelect;
