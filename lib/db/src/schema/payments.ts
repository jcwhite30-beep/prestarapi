import { pgTable, serial, integer, numeric, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").notNull(),
  agencyId: integer("agency_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending_reconciliation"),
  // statuses: pending_reconciliation, reconciled, reversed
  registeredById: integer("registered_by_id").notNull(),
  reconciledById: integer("reconciled_by_id"),
  image: text("image"), // base64 or URL
  date: date("date").notNull().defaultNow(),
  appliedOverdue: numeric("applied_overdue", { precision: 12, scale: 2 }).default("0"),
  appliedCurrent: numeric("applied_current", { precision: 12, scale: 2 }).default("0"),
  appliedCapital: numeric("applied_capital", { precision: 12, scale: 2 }).default("0"),
  forgivenInterest: numeric("forgiven_interest", { precision: 12, scale: 2 }).default("0"),
  forgivenCapital: numeric("forgiven_capital", { precision: 12, scale: 2 }).default("0"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
