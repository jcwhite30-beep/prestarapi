import { pgTable, serial, integer, numeric, text, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const movementsTable = pgTable("movements", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").notNull(),
  type: text("type").notNull(),
  // types: disbursement, interest_accrual, payment_overdue_interest, payment_current_interest, payment_capital, forgiveness, reversal
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  concept: text("concept").notNull(),
  date: date("date").notNull().defaultNow(),
  userId: integer("user_id"),
  reversed: boolean("reversed").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMovementSchema = createInsertSchema(movementsTable).omit({ id: true, createdAt: true });
export type InsertMovement = z.infer<typeof insertMovementSchema>;
export type Movement = typeof movementsTable.$inferSelect;
