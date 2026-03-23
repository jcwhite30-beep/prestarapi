import { pgTable, serial, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  email: text("email"),
  role: text("role").notNull(), // superadmin, admin, manager, promoter
  agencyIds: jsonb("agency_ids").notNull().default([]),
  blocked: boolean("blocked").notNull().default(false),
  avatar: text("avatar"),
  needsPasswordRecovery: boolean("needs_password_recovery").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
