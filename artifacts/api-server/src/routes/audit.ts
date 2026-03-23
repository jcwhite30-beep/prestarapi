import { Router } from "express";
import { db } from "@workspace/db";
import { auditTable, usersTable, agenciesTable } from "@workspace/db";
import { gte, lte, eq, and, type SQL } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("superadmin", "admin"));

// GET /api/audit
router.get("/", async (req, res) => {
  const user = (req as any).user;
  const { agencyId, userId, from, to } = req.query;
  
  let entries = await db.select().from(auditTable).orderBy(auditTable.createdAt);
  
  const allUsers = await db.select().from(usersTable);
  const allAgencies = await db.select().from(agenciesTable);
  const userMap = new Map(allUsers.map(u => [u.id, { name: u.name, role: u.role }]));
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  
  if (user.role === "admin") {
    const agIds = (user.agencyIds as number[]) ?? [];
    entries = entries.filter(e => e.agencyId === null || agIds.includes(e.agencyId));
  }
  if (agencyId) entries = entries.filter(e => e.agencyId === parseInt(agencyId as string));
  if (userId) entries = entries.filter(e => e.userId === parseInt(userId as string));
  if (from) entries = entries.filter(e => e.createdAt >= new Date(from as string));
  if (to) entries = entries.filter(e => e.createdAt <= new Date(to as string + "T23:59:59Z"));
  
  // Return in descending order (newest first)
  entries = entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  const enriched = entries.map(e => ({
    ...e,
    userName: e.userId ? userMap.get(e.userId)?.name ?? "" : "Sistema",
    userRole: e.userId ? userMap.get(e.userId)?.role ?? "" : "",
    agencyName: e.agencyId ? agencyMap.get(e.agencyId) ?? "" : "",
  }));
  
  res.json(enriched);
});

export default router;
