import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trashTable = pgTable("trash", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // loan, client, user, agency, funder, payment
  entityId: integer("entity_id").notNull(),
  agencyId: integer("agency_id"),
  data: jsonb("data").notNull(),
  deletedById: integer("deleted_by_id"),
  deletedAt: timestamp("deleted_at").notNull().defaultNow(),
  restoredAt: timestamp("restored_at"),
});

export const insertTrashSchema = createInsertSchema(trashTable).omit({ id: true, deletedAt: true });
export type InsertTrash = z.infer<typeof insertTrashSchema>;
export type Trash = typeof trashTable.$inferSelect;
