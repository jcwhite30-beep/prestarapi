import { pgTable, serial, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fundersTable = pgTable("funders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  capital: numeric("capital", { precision: 12, scale: 2 }).notNull().default("0"),
  rateToPayPercent: numeric("rate_to_pay_percent", { precision: 5, scale: 4 }).notNull().default("0.05"),
  agencyId: integer("agency_id").notNull(),
  periodicity: text("periodicity").notNull().default("biweekly"),
  active: boolean("active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const funderTransactionsTable = pgTable("funder_transactions", {
  id: serial("id").primaryKey(),
  funderId: integer("funder_id").notNull(),
  type: text("type").notNull(), // increase, withdrawal
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  proof: text("proof"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFunderSchema = createInsertSchema(fundersTable).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertFunder = z.infer<typeof insertFunderSchema>;
export type Funder = typeof fundersTable.$inferSelect;
