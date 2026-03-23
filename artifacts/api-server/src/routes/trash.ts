import { Router } from "express";
import { db } from "@workspace/db";
import { trashTable, agenciesTable, usersTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("superadmin", "admin"));

// GET /api/trash
router.get("/", async (req, res) => {
  const user = (req as any).user;
  const { agencyId } = req.query;
  
  let items = await db.select().from(trashTable).where(isNull(trashTable.restoredAt));
  const allAgencies = await db.select().from(agenciesTable);
  const allUsers = await db.select().from(usersTable);
  
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  const userMap = new Map(allUsers.map(u => [u.id, u.name]));
  
  if (user.role === "admin") {
    const agIds = (user.agencyIds as number[]) ?? [];
    items = items.filter(i => i.agencyId === null || agIds.includes(i.agencyId));
  }
  if (agencyId) items = items.filter(i => i.agencyId === parseInt(agencyId as string));
  
  const enriched = items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime()).map(i => ({
    ...i,
    agencyName: i.agencyId ? agencyMap.get(i.agencyId) ?? "" : "",
    deletedByName: i.deletedById ? userMap.get(i.deletedById) ?? "" : "",
  }));
  
  res.json(enriched);
});

// POST /api/trash/:id/restore
router.post("/:id/restore", async (req, res) => {
  const id = parseInt(req.params.id);
  const [item] = await db.update(trashTable).set({ restoredAt: new Date() }).where(eq(trashTable.id, id)).returning();
  await logAudit(req, "RESTORE_FROM_TRASH", item.type, item.entityId, item.agencyId);
  res.json({ success: true, message: "Item restaurado" });
});

export default router;
