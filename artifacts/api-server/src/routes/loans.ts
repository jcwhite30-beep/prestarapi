import { Router } from "express";
import { db } from "@workspace/db";
import { loansTable, clientsTable, agenciesTable, usersTable, movementsTable, trashTable, paymentsTable } from "@workspace/db";
import { eq, isNull, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";
import { firstCutAfterDisbursement } from "../lib/interest.js";

const router = Router();
router.use(requireAuth);

async function enrichLoan(loan: typeof loansTable.$inferSelect, clients: Map<number, string>, agencies: Map<number, string>, users: Map<number, string>) {
  return {
    ...loan,
    clientName: clients.get(loan.clientId) ?? "",
    agencyName: agencies.get(loan.agencyId) ?? "",
    promoterName: users.get(loan.promoterId) ?? "",
    overdueInterest: parseFloat(loan.overdueInterest),
    currentInterest: parseFloat(loan.currentInterest),
    originalCapital: parseFloat(loan.originalCapital),
    currentCapital: parseFloat(loan.currentCapital),
    rate: parseFloat(loan.rate),
    portfolioCommissionRate: parseFloat(loan.portfolioCommissionRate ?? "0"),
  };
}

// GET /api/loans
router.get("/", async (req, res) => {
  const user = (req as any).user;
  const { agencyId, status, assignedTo, clientId } = req.query;
  
  let loans = await db.select().from(loansTable).where(isNull(loansTable.deletedAt));
  const allClients = await db.select().from(clientsTable);
  const allAgencies = await db.select().from(agenciesTable);
  const allUsers = await db.select().from(usersTable);
  
  const clientMap = new Map(allClients.map(c => [c.id, c.name]));
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  const userMap = new Map(allUsers.map(u => [u.id, u.name]));
  
  // Role filter
  if (user.role === "promoter") {
    loans = loans.filter(l => l.promoterId === user.id);
  } else if (user.role === "manager") {
    const agIds = (user.agencyIds as number[]) ?? [];
    loans = loans.filter(l => agIds.includes(l.agencyId));
  } else if (user.role === "admin") {
    const agIds = (user.agencyIds as number[]) ?? [];
    loans = loans.filter(l => agIds.includes(l.agencyId));
  }
  
  if (agencyId) loans = loans.filter(l => l.agencyId === parseInt(agencyId as string));
  if (status) loans = loans.filter(l => l.status === status);
  if (clientId) loans = loans.filter(l => l.clientId === parseInt(clientId as string));
  if (assignedTo) {
    const uid = parseInt(assignedTo as string);
    const clientIds = allClients.filter(c => c.assignedToId === uid).map(c => c.id);
    loans = loans.filter(l => clientIds.includes(l.clientId));
  }
  
  const enriched = await Promise.all(loans.map(l => enrichLoan(l, clientMap, agencyMap, userMap)));
  res.json(enriched);
});

// POST /api/loans
router.post("/", async (req, res) => {
  const user = (req as any).user;
  const data = req.body;
  
  // Check client is not in default before creating new loan
  const existingLoans = await db.select().from(loansTable).where(eq(loansTable.clientId, data.clientId));
  const hasDefault = existingLoans.some(l => l.status === "active" && parseFloat(l.overdueInterest) > 0);
  if (hasDefault) {
    res.status(400).json({ error: "El cliente tiene saldo vencido. No se puede crear nuevo préstamo." });
    return;
  }
  
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, data.agencyId));
  const baseRate = agency ? parseFloat(agency.baseRate) : 0.10;
  
  const [loan] = await db.insert(loansTable).values({
    clientId: data.clientId,
    agencyId: data.agencyId,
    promoterId: user.id,
    originalCapital: data.amount.toString(),
    currentCapital: data.amount.toString(),
    rate: baseRate.toString(),
    periodicity: data.periodicity ?? "biweekly",
    portfolioCommissionRate: data.portfolioCommissionRate?.toString() ?? "0",
    status: "pending_approval",
    disbursementMethod: data.disbursementMethod,
    overdueInterest: "0",
    currentInterest: "0",
    inDefault: false,
  }).returning();
  
  await logAudit(req, "CREATE_LOAN", "loan", loan.id, loan.agencyId, { clientId: data.clientId, amount: data.amount });
  
  const allClients = await db.select().from(clientsTable);
  const allAgencies = await db.select().from(agenciesTable);
  const allUsers = await db.select().from(usersTable);
  const clientMap = new Map(allClients.map(c => [c.id, c.name]));
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  const userMap = new Map(allUsers.map(u => [u.id, u.name]));
  
  res.status(201).json(await enrichLoan(loan, clientMap, agencyMap, userMap));
});

// GET /api/loans/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, id));
  if (!loan) { res.status(404).json({ error: "No encontrado" }); return; }
  const allClients = await db.select().from(clientsTable);
  const allAgencies = await db.select().from(agenciesTable);
  const allUsers = await db.select().from(usersTable);
  const clientMap = new Map(allClients.map(c => [c.id, c.name]));
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  const userMap = new Map(allUsers.map(u => [u.id, u.name]));
  res.json(await enrichLoan(loan, clientMap, agencyMap, userMap));
});

// POST /api/loans/:id/approve
router.post("/:id/approve", requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [loan] = await db.update(loansTable).set({ status: "pending_disbursement" }).where(eq(loansTable.id, id)).returning();
  await logAudit(req, "APPROVE_LOAN", "loan", id, loan.agencyId);
  res.json(loan);
});

// POST /api/loans/:id/reject
router.post("/:id/reject", requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { reason } = req.body;
  const [loan] = await db.update(loansTable).set({ status: "rejected", rejectReason: reason ?? null }).where(eq(loansTable.id, id)).returning();
  await db.insert(trashTable).values({ type: "loan_rejected", entityId: id, agencyId: loan.agencyId, data: loan as any, deletedById: (req as any).user.id });
  await logAudit(req, "REJECT_LOAN", "loan", id, loan.agencyId, { reason });
  res.json(loan);
});

// POST /api/loans/:id/disburse
router.post("/:id/disburse", requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { rate, disbursementMethod, proof, periodicity } = req.body;
  
  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, id));
  if (!loan) { res.status(404).json({ error: "Préstamo no encontrado" }); return; }
  
  // Check available flow in the agency (block if insufficient)
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, loan.agencyId));
  const loanAmount = parseFloat(loan.originalCapital);
  const agencyFlow = agency ? parseFloat(agency.availableFlow) : 0;
  
  if (agencyFlow < loanAmount) {
    res.status(400).json({ 
      error: `Flujo disponible insuficiente. Disponible: ${agencyFlow.toFixed(2)}, Requerido: ${loanAmount.toFixed(2)}` 
    });
    return;
  }
  
  const now = new Date();
  const cutDate = firstCutAfterDisbursement(now, periodicity ?? "biweekly");
  
  const [updatedLoan] = await db.update(loansTable).set({
    status: "active",
    rate: rate?.toString() ?? "0.10",
    periodicity: periodicity ?? "biweekly",
    disbursementMethod,
    disbursementProof: proof ?? null,
    disbursementDate: now.toISOString().slice(0, 10),
    nextCutDate: cutDate.toISOString().slice(0, 10),
    lastInterestDate: now.toISOString().slice(0, 10),
  }).where(eq(loansTable.id, id)).returning();
  
  // Decrease agency available flow
  await db.update(agenciesTable).set({
    availableFlow: (agencyFlow - loanAmount).toFixed(2),
  }).where(eq(agenciesTable.id, loan.agencyId));
  
  // Record disbursement movement
  await db.insert(movementsTable).values({
    loanId: id,
    type: "disbursement",
    amount: updatedLoan.currentCapital,
    concept: `Desembolso - ${disbursementMethod}`,
    date: now.toISOString().slice(0, 10),
    userId: (req as any).user.id,
    image: proof ?? null,
  });
  
  await logAudit(req, "DISBURSE_LOAN", "loan", id, updatedLoan.agencyId, { amount: updatedLoan.originalCapital, method: disbursementMethod });
  
  const allClients = await db.select().from(clientsTable);
  const allAgencies = await db.select().from(agenciesTable);
  const allUsers = await db.select().from(usersTable);
  const clientMap = new Map(allClients.map(c => [c.id, c.name]));
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  const userMap = new Map(allUsers.map(u => [u.id, u.name]));
  
  res.json(await enrichLoan(updatedLoan, clientMap, agencyMap, userMap));
});

// POST /api/loans/:id/reverse
router.post("/:id/reverse", requireRole("superadmin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, id));
  if (!loan) { res.status(404).json({ error: "Préstamo no encontrado" }); return; }
  
  // If loan was active (disbursed), restore the agency flow
  if (loan.status === "active") {
    const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, loan.agencyId));
    if (agency) {
      const restoredFlow = parseFloat(agency.availableFlow) + parseFloat(loan.originalCapital);
      await db.update(agenciesTable).set({ availableFlow: restoredFlow.toFixed(2) }).where(eq(agenciesTable.id, loan.agencyId));
    }
  }
  
  const [reversed] = await db.update(loansTable).set({
    status: "pending_disbursement",
    disbursementDate: null,
    nextCutDate: null,
    disbursementProof: null,
    currentInterest: "0",
    overdueInterest: "0",
    inDefault: false,
  }).where(eq(loansTable.id, id)).returning();
  
  await db.insert(movementsTable).values({
    loanId: id,
    type: "reversal",
    amount: reversed.originalCapital,
    concept: "REVERSIÓN DE DESEMBOLSO AUTORIZADA",
    date: new Date().toISOString().slice(0, 10),
    userId: (req as any).user.id,
  });
  
  await logAudit(req, "REVERSE_DISBURSEMENT", "loan", id, reversed.agencyId);
  res.json(reversed);
});

// PATCH /api/loans/:id/commission — update portfolio commission rate (assigned user only)
router.patch("/:id/commission", async (req, res) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id);
  const { portfolioCommissionRate } = req.body;
  
  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, id));
  if (!loan) { res.status(404).json({ error: "No encontrado" }); return; }
  
  // Only the assigned promoter (or managers/admins of the agency) can update commission
  const isAssignedPromoter = loan.promoterId === user.id;
  const isManagerOrAdmin = ["manager", "admin", "superadmin"].includes(user.role);
  if (!isAssignedPromoter && !isManagerOrAdmin) {
    res.status(403).json({ error: "Sin permiso para actualizar la comisión" });
    return;
  }
  
  const [updated] = await db.update(loansTable).set({
    portfolioCommissionRate: parseFloat(portfolioCommissionRate ?? 0).toFixed(4),
  }).where(eq(loansTable.id, id)).returning();
  
  await logAudit(req, "UPDATE_COMMISSION", "loan", id, loan.agencyId, { portfolioCommissionRate });
  res.json({ ...updated, portfolioCommissionRate: parseFloat(updated.portfolioCommissionRate ?? "0") });
});

export default router;
