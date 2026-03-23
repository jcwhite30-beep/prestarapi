import { Router } from "express";
import { db } from "@workspace/db";
import { paymentsTable, loansTable, movementsTable, clientsTable, usersTable, agenciesTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";
import { applyPayment, nextCutDate } from "../lib/interest.js";

const router = Router();
router.use(requireAuth);

// GET /api/payments
router.get("/", async (req, res) => {
  const user = (req as any).user;
  const { agencyId, status, loanId } = req.query;
  
  let payments = await db.select().from(paymentsTable).where(isNull(paymentsTable.deletedAt));
  const allLoans = await db.select().from(loansTable);
  const allClients = await db.select().from(clientsTable);
  const allUsers = await db.select().from(usersTable);
  
  const clientMap = new Map(allClients.map(c => [c.id, c.name]));
  const userMap = new Map(allUsers.map(u => [u.id, u.name]));
  const loanMap = new Map(allLoans.map(l => [l.id, l]));
  
  if (user.role === "promoter") {
    payments = payments.filter(p => {
      const loan = loanMap.get(p.loanId);
      return loan && loan.promoterId === user.id;
    });
  } else if (user.role === "manager") {
    const agIds = (user.agencyIds as number[]) ?? [];
    payments = payments.filter(p => agIds.includes(p.agencyId));
  } else if (user.role === "admin") {
    const agIds = (user.agencyIds as number[]) ?? [];
    payments = payments.filter(p => agIds.includes(p.agencyId));
  }
  
  if (agencyId) payments = payments.filter(p => p.agencyId === parseInt(agencyId as string));
  if (status) payments = payments.filter(p => p.status === status);
  if (loanId) payments = payments.filter(p => p.loanId === parseInt(loanId as string));
  
  const enriched = payments.map(p => {
    const loan = loanMap.get(p.loanId);
    return {
      ...p,
      clientName: loan ? clientMap.get(loan.clientId) ?? "" : "",
      registeredByName: userMap.get(p.registeredById) ?? "",
      reconciledByName: p.reconciledById ? userMap.get(p.reconciledById) ?? "" : "",
      amount: parseFloat(p.amount),
      appliedOverdue: parseFloat(p.appliedOverdue ?? "0"),
      appliedCurrent: parseFloat(p.appliedCurrent ?? "0"),
      appliedCapital: parseFloat(p.appliedCapital ?? "0"),
      forgivenInterest: parseFloat(p.forgivenInterest ?? "0"),
      forgivenCapital: parseFloat(p.forgivenCapital ?? "0"),
    };
  });
  
  res.json(enriched);
});

// POST /api/payments
router.post("/", async (req, res) => {
  const user = (req as any).user;
  const { loanId, amount, image, notes } = req.body;
  
  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, loanId));
  if (!loan) { res.status(404).json({ error: "Préstamo no encontrado" }); return; }
  
  const [payment] = await db.insert(paymentsTable).values({
    loanId,
    agencyId: loan.agencyId,
    amount: amount.toString(),
    status: "pending_reconciliation",
    registeredById: user.id,
    image: image ?? null,
    date: new Date().toISOString().slice(0, 10),
  }).returning();
  
  await logAudit(req, "REGISTER_PAYMENT", "payment", payment.id, loan.agencyId, { amount, loanId });
  res.status(201).json({ ...payment, amount: parseFloat(payment.amount) });
});

// POST /api/payments/:id/reconcile
router.post("/:id/reconcile", requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id);
  const { forgivenInterest = 0, forgivenCapital = 0 } = req.body;
  
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
  if (!payment) { res.status(404).json({ error: "Pago no encontrado" }); return; }
  
  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, payment.loanId));
  if (!loan) { res.status(404).json({ error: "Préstamo no encontrado" }); return; }
  
  const amount = parseFloat(payment.amount);
  const overdueInterest = parseFloat(loan.overdueInterest);
  const currentInterest = parseFloat(loan.currentInterest);
  const capital = parseFloat(loan.currentCapital);
  
  const result = applyPayment(amount, overdueInterest, currentInterest, capital, forgivenInterest, forgivenCapital);
  
  // Update loan balances
  const newOverdue = overdueInterest - result.appliedOverdue - Math.min(forgivenInterest, overdueInterest);
  const newCurrent = currentInterest - result.appliedCurrent - Math.max(0, forgivenInterest - overdueInterest);
  const newCapital = capital - result.appliedCapital - forgivenCapital;
  
  const isSettled = newCapital <= 0.01;
  const isNowInDefault = newOverdue > 0.01;
  
  // Calculate next cut date
  const nextCut = loan.nextCutDate ? nextCutDate(new Date(loan.nextCutDate), loan.periodicity).toISOString().slice(0, 10) : null;
  
  await db.update(loansTable).set({
    overdueInterest: Math.max(0, newOverdue).toFixed(2),
    currentInterest: Math.max(0, newCurrent).toFixed(2),
    currentCapital: Math.max(0, newCapital).toFixed(2),
    inDefault: isNowInDefault,
    status: isSettled ? "settled" : "active",
    nextCutDate: isSettled ? null : nextCut,
    lastInterestDate: new Date().toISOString().slice(0, 10),
  }).where(eq(loansTable.id, loan.id));
  
  // Increase agency available flow by the capital paid back
  if (result.appliedCapital > 0) {
    const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, loan.agencyId));
    if (agency) {
      const newFlow = parseFloat(agency.availableFlow) + result.appliedCapital;
      await db.update(agenciesTable).set({ availableFlow: newFlow.toFixed(2) }).where(eq(agenciesTable.id, loan.agencyId));
    }
  }
  
  // Auto-deactivate client when loan is fully settled (currentCapital ≤ 0)
  if (isSettled) {
    const client = await db.select().from(clientsTable).where(eq(clientsTable.id, loan.clientId));
    if (client.length > 0) {
      // Check if client has any other active loans
      const otherActiveLoans = await db.select().from(loansTable).where(eq(loansTable.clientId, loan.clientId));
      const hasOtherActiveLoans = otherActiveLoans.some(l => l.id !== loan.id && l.status === "active");
      if (!hasOtherActiveLoans) {
        await db.update(clientsTable).set({ active: false }).where(eq(clientsTable.id, loan.clientId));
      }
    }
  }
  
  // Update payment record
  const [reconciled] = await db.update(paymentsTable).set({
    status: "reconciled",
    reconciledById: user.id,
    appliedOverdue: result.appliedOverdue.toFixed(2),
    appliedCurrent: result.appliedCurrent.toFixed(2),
    appliedCapital: result.appliedCapital.toFixed(2),
    forgivenInterest: forgivenInterest.toFixed(2),
    forgivenCapital: forgivenCapital.toFixed(2),
  }).where(eq(paymentsTable.id, id)).returning();
  
  // Record movements
  const date = new Date().toISOString().slice(0, 10);
  if (result.appliedOverdue > 0) {
    await db.insert(movementsTable).values({ loanId: loan.id, type: "payment_overdue_interest", amount: result.appliedOverdue.toFixed(2), concept: "Pago intereses vencidos", date, userId: user.id, image: payment.image ?? null });
  }
  if (result.appliedCurrent > 0) {
    await db.insert(movementsTable).values({ loanId: loan.id, type: "payment_current_interest", amount: result.appliedCurrent.toFixed(2), concept: "Pago intereses vigentes", date, userId: user.id });
  }
  if (result.appliedCapital > 0) {
    await db.insert(movementsTable).values({ loanId: loan.id, type: "payment_capital", amount: result.appliedCapital.toFixed(2), concept: "Abono a capital", date, userId: user.id });
  }
  if (forgivenInterest > 0 || forgivenCapital > 0) {
    await db.insert(movementsTable).values({ loanId: loan.id, type: "forgiveness", amount: (forgivenInterest + forgivenCapital).toFixed(2), concept: `Condonación: interés ${forgivenInterest}, capital ${forgivenCapital}`, date, userId: user.id });
  }
  
  await logAudit(req, "RECONCILE_PAYMENT", "payment", id, loan.agencyId, { amount, appliedCapital: result.appliedCapital, forgivenInterest, forgivenCapital });
  
  res.json({ ...reconciled, amount: parseFloat(reconciled.amount) });
});

// POST /api/payments/:id/reverse
router.post("/:id/reverse", requireRole("superadmin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
  if (!payment || payment.status !== "reconciled") {
    res.status(400).json({ error: "Solo se pueden revertir pagos conciliados" });
    return;
  }
  
  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, payment.loanId));
  if (!loan) { res.status(404).json({ error: "Préstamo no encontrado" }); return; }
  
  // Reverse the payment application
  const newCapital = (parseFloat(loan.currentCapital) + parseFloat(payment.appliedCapital ?? "0") + parseFloat(payment.forgivenCapital ?? "0")).toFixed(2);
  const newOverdue = (parseFloat(loan.overdueInterest) + parseFloat(payment.appliedOverdue ?? "0")).toFixed(2);
  const newCurrent = (parseFloat(loan.currentInterest) + parseFloat(payment.appliedCurrent ?? "0") + parseFloat(payment.forgivenInterest ?? "0")).toFixed(2);
  
  await db.update(loansTable).set({
    currentCapital: newCapital,
    overdueInterest: newOverdue,
    currentInterest: newCurrent,
    status: "active",
    inDefault: parseFloat(newOverdue) > 0,
  }).where(eq(loansTable.id, loan.id));
  
  // Reverse the flow increase from capital payment
  const capitalReversed = parseFloat(payment.appliedCapital ?? "0") + parseFloat(payment.forgivenCapital ?? "0");
  if (capitalReversed > 0) {
    const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, loan.agencyId));
    if (agency) {
      const newFlow = Math.max(0, parseFloat(agency.availableFlow) - capitalReversed);
      await db.update(agenciesTable).set({ availableFlow: newFlow.toFixed(2) }).where(eq(agenciesTable.id, loan.agencyId));
    }
  }
  
  // Re-activate client if was deactivated
  await db.update(clientsTable).set({ active: true }).where(eq(clientsTable.id, loan.clientId));
  
  const [reversed] = await db.update(paymentsTable).set({ status: "reversed" }).where(eq(paymentsTable.id, id)).returning();
  
  await db.insert(movementsTable).values({
    loanId: loan.id,
    type: "reversal",
    amount: payment.amount,
    concept: "REVERSIÓN DE PAGO AUTORIZADA",
    date: new Date().toISOString().slice(0, 10),
    userId: (req as any).user.id,
  });
  
  await logAudit(req, "REVERSE_PAYMENT", "payment", id, loan.agencyId);
  res.json({ ...reversed, amount: parseFloat(reversed.amount) });
});

// GET /api/payments/movements
router.get("/movements", async (req, res) => {
  const { loanId, agencyId } = req.query;
  let movements = await db.select().from(movementsTable);
  if (loanId) movements = movements.filter(m => m.loanId === parseInt(loanId as string));
  
  const allUsers = await db.select().from(usersTable);
  const userMap = new Map(allUsers.map(u => [u.id, u.name]));
  
  res.json(movements.map(m => ({
    ...m,
    amount: parseFloat(m.amount),
    userName: m.userId ? userMap.get(m.userId) ?? "" : "",
  })));
});

export default router;
