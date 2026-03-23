import { Router } from "express";
import { db } from "@workspace/db";
import { fundersTable, funderTransactionsTable, agenciesTable, trashTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

// GET /api/funders
router.get("/", requireRole("superadmin", "admin"), async (req, res) => {
  const user = (req as any).user;
  const { agencyId } = req.query;
  
  let funders = await db.select().from(fundersTable).where(eq(fundersTable.active, true));
  const allAgencies = await db.select().from(agenciesTable);
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  
  if (user.role === "admin") {
    const agIds = (user.agencyIds as number[]) ?? [];
    funders = funders.filter(f => agIds.includes(f.agencyId));
  }
  if (agencyId) funders = funders.filter(f => f.agencyId === parseInt(agencyId as string));
  
  res.json(funders.map(f => ({
    ...f,
    agencyName: agencyMap.get(f.agencyId) ?? "",
    capital: parseFloat(f.capital),
    rateToPayPercent: parseFloat(f.rateToPayPercent),
  })));
});

// POST /api/funders
router.post("/", requireRole("superadmin", "admin"), async (req, res) => {
  const data = req.body;
  const [funder] = await db.insert(fundersTable).values({
    name: data.name,
    capital: data.capital.toString(),
    rateToPayPercent: data.rateToPayPercent.toString(),
    agencyId: data.agencyId,
    periodicity: data.periodicity ?? "biweekly",
    active: true,
  }).returning();
  
  // Record initial capital as a transaction
  await db.insert(funderTransactionsTable).values({
    funderId: funder.id,
    type: "increase",
    amount: data.capital.toString(),
    note: "Capital inicial",
    userId: (req as any).user.id,
  });
  
  await logAudit(req, "CREATE_FUNDER", "funder", funder.id, funder.agencyId, { name: funder.name, capital: data.capital });
  
  const allAgencies = await db.select().from(agenciesTable);
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  
  res.status(201).json({ ...funder, agencyName: agencyMap.get(funder.agencyId) ?? "", capital: parseFloat(funder.capital), rateToPayPercent: parseFloat(funder.rateToPayPercent) });
});

// PUT /api/funders/:id
router.put("/:id", requireRole("superadmin", "admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const data = req.body;
  const [funder] = await db.update(fundersTable).set({
    name: data.name,
    rateToPayPercent: data.rateToPayPercent?.toString(),
    agencyId: data.agencyId,
    periodicity: data.periodicity,
  }).where(eq(fundersTable.id, id)).returning();
  
  const allAgencies = await db.select().from(agenciesTable);
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  
  res.json({ ...funder, agencyName: agencyMap.get(funder.agencyId) ?? "", capital: parseFloat(funder.capital), rateToPayPercent: parseFloat(funder.rateToPayPercent) });
});

// DELETE /api/funders/:id
router.delete("/:id", requireRole("superadmin", "admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [funder] = await db.select().from(fundersTable).where(eq(fundersTable.id, id));
  if (!funder) { res.status(404).json({ error: "No encontrado" }); return; }
  await db.insert(trashTable).values({ type: "funder", entityId: id, agencyId: funder.agencyId, data: funder as any, deletedById: (req as any).user.id });
  await db.update(fundersTable).set({ active: false, deletedAt: new Date() }).where(eq(fundersTable.id, id));
  await logAudit(req, "DELETE_FUNDER", "funder", id, funder.agencyId);
  res.json({ success: true, message: "Fondeador eliminado" });
});

// POST /api/funders/:id/transaction
router.post("/:id/transaction", requireRole("superadmin", "admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { type, amount, note, proof } = req.body;
  
  const [funder] = await db.select().from(fundersTable).where(eq(fundersTable.id, id));
  if (!funder) { res.status(404).json({ error: "No encontrado" }); return; }
  
  const currentCapital = parseFloat(funder.capital);
  const newCapital = type === "increase" ? currentCapital + amount : currentCapital - amount;
  
  if (newCapital < 0) {
    res.status(400).json({ error: "Capital insuficiente para retiro" });
    return;
  }
  
  await db.insert(funderTransactionsTable).values({
    funderId: id,
    type,
    amount: amount.toString(),
    note: note ?? null,
    proof: proof ?? null,
    userId: (req as any).user.id,
  });
  
  const [updated] = await db.update(fundersTable).set({ capital: newCapital.toFixed(2) }).where(eq(fundersTable.id, id)).returning();
  
  await logAudit(req, type === "increase" ? "FUNDER_INCREASE" : "FUNDER_WITHDRAWAL", "funder", id, funder.agencyId, { amount, type });
  
  const allAgencies = await db.select().from(agenciesTable);
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  
  res.json({ ...updated, agencyName: agencyMap.get(updated.agencyId) ?? "", capital: parseFloat(updated.capital), rateToPayPercent: parseFloat(updated.rateToPayPercent) });
});

export default router;
