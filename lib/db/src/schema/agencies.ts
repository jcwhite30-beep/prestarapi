import { pgTable, serial, text, boolean, numeric, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agenciesTable = pgTable("agencies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  active: boolean("active").notNull().default(true),
  currency: text("currency").notNull().default("USD"),
  baseRate: numeric("base_rate", { precision: 5, scale: 4 }).notNull().default("0.10"),
  graceDaysDisbursement: integer("grace_days_disbursement").notNull().default(3),
  graceDaysPayment: integer("grace_days_payment").notNull().default(3),
  paymentMethods: jsonb("payment_methods").notNull().default(["Efectivo"]),
  banks: jsonb("banks").notNull().default([]),
  availableFlow: numeric("available_flow", { precision: 15, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAgencySchema = createInsertSchema(agenciesTable).omit({ id: true, createdAt: true });
export type InsertAgency = z.infer<typeof insertAgencySchema>;
export type Agency = typeof agenciesTable.$inferSelect;
