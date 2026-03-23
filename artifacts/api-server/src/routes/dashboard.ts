import { Router } from "express";
import { db } from "@workspace/db";
import { loansTable, clientsTable, agenciesTable, usersTable, paymentsTable, fundersTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { getUpcomingCuts } from "../lib/interest.js";

const router = Router();
router.use(requireAuth);

// GET /api/dashboard/stats
router.get("/stats", async (req, res) => {
  const user = (req as any).user;
  const { agencyId, userId } = req.query;
  
  const allLoans = await db.select().from(loansTable).where(isNull(loansTable.deletedAt));
  const allClients = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
  const allAgencies = await db.select().from(agenciesTable);
  const allUsers = await db.select().from(usersTable);
  const allPayments = await db.select().from(paymentsTable).where(isNull(paymentsTable.deletedAt));
  const allFunders = await db.select().from(fundersTable).where(eq(fundersTable.active, true));
  
  const agencyMap = new Map(allAgencies.map(a => [a.id, a]));
  const userMap = new Map(allUsers.map(u => [u.id, u]));
  
  let filteredLoans = allLoans;
  let filteredClients = allClients;
  let filteredPayments = allPayments;
  let filteredFunders = allFunders;
  
  // Role-based filtering
  let allowedAgencyIds: number[] | null = null;
  if (user.role === "promoter") {
    filteredClients = allClients.filter(c => c.assignedToId === user.id);
    const clientIds = filteredClients.map(c => c.id);
    filteredLoans = allLoans.filter(l => clientIds.includes(l.clientId));
  } else if (user.role === "manager") {
    allowedAgencyIds = (user.agencyIds as number[]) ?? [];
  } else if (user.role === "admin") {
    allowedAgencyIds = (user.agencyIds as number[]) ?? [];
  }
  
  if (allowedAgencyIds !== null) {
    filteredLoans = filteredLoans.filter(l => allowedAgencyIds!.includes(l.agencyId));
    filteredClients = filteredClients.filter(c => allowedAgencyIds!.includes(c.agencyId));
    filteredPayments = filteredPayments.filter(p => allowedAgencyIds!.includes(p.agencyId));
    filteredFunders = filteredFunders.filter(f => allowedAgencyIds!.includes(f.agencyId));
  }
  
  // Apply query filters (FIX: use filteredClients, not allClients)
  if (agencyId) {
    const aid = parseInt(agencyId as string);
    filteredLoans = filteredLoans.filter(l => l.agencyId === aid);
    filteredClients = filteredClients.filter(c => c.agencyId === aid);
    filteredPayments = filteredPayments.filter(p => p.agencyId === aid);
    filteredFunders = filteredFunders.filter(f => f.agencyId === aid);
  }
  if (userId) {
    const uid = parseInt(userId as string);
    // BUG FIX: use filteredClients (already narrowed by role/agency) not allClients
    const targetClients = filteredClients.filter(c => c.assignedToId === uid);
    const targetClientIds = targetClients.map(c => c.id);
    filteredLoans = filteredLoans.filter(l => targetClientIds.includes(l.clientId));
    filteredClients = targetClients;
  }
  
  const activeLoans = filteredLoans.filter(l => l.status === "active");
  
  let totalCapital = 0, totalCurrent = 0, totalOverdue = 0;
  for (const l of activeLoans) {
    totalCapital += parseFloat(l.currentCapital);
    totalCurrent += parseFloat(l.currentInterest);
    totalOverdue += parseFloat(l.overdueInterest);
  }
  
  // Commission stats (portfolio commission — promoter-visible, not in global interest)
  let totalCommissionDue = 0;
  for (const l of activeLoans) {
    const rate = parseFloat(l.portfolioCommissionRate ?? "0");
    if (rate > 0) totalCommissionDue += parseFloat(l.currentCapital) * rate;
  }
  
  // Interest collected = reconciled payments' applied overdue + applied current
  const reconciledPayments = filteredPayments.filter(p => p.status === "reconciled");
  const interestCollected = reconciledPayments.reduce((sum, p) => sum + parseFloat(p.appliedOverdue ?? "0") + parseFloat(p.appliedCurrent ?? "0"), 0);
  
  // Upcoming cuts
  const loanDataForCuts = activeLoans.map(l => ({
    id: l.id,
    currentCapital: parseFloat(l.currentCapital),
    rate: parseFloat(l.rate),
    periodicity: l.periodicity,
    disbursementDate: l.disbursementDate,
    lastInterestDate: l.lastInterestDate,
    nextCutDate: l.nextCutDate,
    overdueInterest: parseFloat(l.overdueInterest),
    currentInterest: parseFloat(l.currentInterest),
    status: l.status,
  }));
  
  const upcomingCutIds = getUpcomingCuts(loanDataForCuts, 14);
  const clientMap = new Map(allClients.map(c => [c.id, c]));
  
  const upcomingCuts = upcomingCutIds.map(uc => {
    const loan = activeLoans.find(l => l.id === uc.loanId);
    if (!loan) return null;
    const agency = agencyMap.get(loan.agencyId);
    return {
      loanId: uc.loanId,
      clientName: clientMap.get(loan.clientId)?.name ?? "",
      agencyName: agency?.name ?? "",
      cutDate: uc.cutDate.toISOString().slice(0, 10),
      capital: parseFloat(loan.currentCapital),
      interest: parseFloat(loan.currentInterest),
    };
  }).filter(Boolean);
  
  // Portfolio by user (hierarchical) — includes commission stats
  const portfolioByUser = buildPortfolio(user, allUsers, filteredClients, filteredLoans);
  
  // Mis clientes (promoter-level: client list with commission breakdown)
  let misClientes: any[] | undefined;
  if (user.role === "promoter" || userId) {
    const targetUid = userId ? parseInt(userId as string) : user.id;
    const promoterClients = filteredClients.filter(c => c.assignedToId === targetUid);
    misClientes = promoterClients.map(c => {
      const cLoans = activeLoans.filter(l => l.clientId === c.id);
      const capital = cLoans.reduce((s, l) => s + parseFloat(l.currentCapital), 0);
      const currentInterest = cLoans.reduce((s, l) => s + parseFloat(l.currentInterest), 0);
      const overdueInterest = cLoans.reduce((s, l) => s + parseFloat(l.overdueInterest), 0);
      const commission = cLoans.reduce((s, l) => s + parseFloat(l.currentCapital) * parseFloat(l.portfolioCommissionRate ?? "0"), 0);
      return {
        clientId: c.id,
        clientName: c.name,
        phone: c.phone,
        active: c.active,
        capital,
        currentInterest,
        overdueInterest,
        commission,
        totalACobrar: currentInterest + overdueInterest + commission,
      };
    });
  }
  
  // Funders balance
  const externalCapital = filteredFunders.reduce((s, f) => s + parseFloat(f.capital), 0);
  const prestarapiCapital = Math.max(0, totalCapital - externalCapital);
  
  const funders = {
    prestarapiCapital,
    externalFundersCapital: externalCapital,
    totalFund: prestarapiCapital + externalCapital,
    capitalOnStreet: totalCapital,
    availableFlow: Math.max(0, prestarapiCapital + externalCapital - totalCapital),
    totalInterestPaidToFunders: 0,
    nextCutInterestToFunders: filteredFunders.reduce((s, f) => s + parseFloat(f.capital) * parseFloat(f.rateToPayPercent), 0),
  };
  
  res.json({
    totalCapitalOnStreet: totalCapital,
    totalCurrentInterest: totalCurrent,
    totalOverdueInterest: totalOverdue,
    totalActiveClients: filteredClients.filter(c => c.active).length,
    totalActiveLoans: activeLoans.length,
    totalLoansInDefault: activeLoans.filter(l => l.inDefault).length,
    totalCommissionDue,
    upcomingCuts,
    portfolioByUser,
    misClientes,
    interestCollected,
    funders,
  });
});

function buildPortfolio(currentUser: any, allUsers: any[], clients: any[], loans: any[]) {
  const role = currentUser.role;
  
  if (role === "promoter") {
    const myClients = clients.filter(c => c.assignedToId === currentUser.id);
    const myLoans = loans.filter(l => myClients.some(c => c.id === l.clientId) && l.status === "active");
    const commission = myLoans.reduce((s: number, l: any) => s + parseFloat(l.currentCapital) * parseFloat(l.portfolioCommissionRate ?? "0"), 0);
    return [{
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      totalCapital: myLoans.reduce((s: number, l: any) => s + parseFloat(l.currentCapital), 0),
      totalInterest: myLoans.reduce((s: number, l: any) => s + parseFloat(l.currentInterest) + parseFloat(l.overdueInterest), 0),
      totalCommission: commission,
      totalACobrar: myLoans.reduce((s: number, l: any) => s + parseFloat(l.currentInterest) + parseFloat(l.overdueInterest), 0) + commission,
      totalClients: myClients.length,
      totalLoans: myLoans.length,
      children: [],
    }];
  }
  
  const promoters = allUsers.filter(u => u.role === "promoter");
  return promoters.filter(p => {
    const agIds = (p.agencyIds as number[]) ?? [];
    const userAgIds = (currentUser.agencyIds as number[]) ?? [];
    if (role === "superadmin") return true;
    return agIds.some(id => userAgIds.includes(id));
  }).map(p => {
    const pClients = clients.filter(c => c.assignedToId === p.id);
    const pLoans = loans.filter(l => pClients.some(c => c.id === l.clientId) && l.status === "active");
    const commission = pLoans.reduce((s: number, l: any) => s + parseFloat(l.currentCapital) * parseFloat(l.portfolioCommissionRate ?? "0"), 0);
    return {
      userId: p.id,
      userName: p.name,
      role: p.role,
      totalCapital: pLoans.reduce((s: number, l: any) => s + parseFloat(l.currentCapital), 0),
      totalInterest: pLoans.reduce((s: number, l: any) => s + parseFloat(l.currentInterest) + parseFloat(l.overdueInterest), 0),
      totalCommission: commission,
      totalACobrar: pLoans.reduce((s: number, l: any) => s + parseFloat(l.currentInterest) + parseFloat(l.overdueInterest), 0) + commission,
      totalClients: pClients.length,
      totalLoans: pLoans.length,
      children: [],
    };
  });
}

export default router;
