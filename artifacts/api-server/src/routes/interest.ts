import { Router } from "express";
import { db } from "@workspace/db";
import { loansTable, movementsTable, agenciesTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { calculatePeriodInterest, nextCutDate, isInGracePeriod } from "../lib/interest.js";
import { logAudit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

// POST /api/interest/calculate - Run daily interest job
router.post("/calculate", requireRole("superadmin"), async (req, res) => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  
  const activeLoans = await db.select().from(loansTable)
    .where(isNull(loansTable.deletedAt));
  
  const allAgencies = await db.select().from(agenciesTable);
  const agencyMap = new Map(allAgencies.map(a => [a.id, a]));
  
  let processed = 0;
  
  for (const loan of activeLoans) {
    if (loan.status !== "active") continue;
    if (!loan.nextCutDate) continue;
    
    const agency = agencyMap.get(loan.agencyId);
    const graceDays = agency ? agency.graceDaysDisbursement : 3;
    
    // Check if today is the cut date
    if (loan.nextCutDate !== todayStr) continue;
    
    // Check grace period from disbursement date
    if (loan.disbursementDate) {
      const disbDate = new Date(loan.disbursementDate);
      if (isInGracePeriod(disbDate, graceDays, today)) {
        continue; // Skip interest during grace period
      }
    }
    
    const capital = parseFloat(loan.currentCapital);
    const rate = parseFloat(loan.rate);
    const interest = calculatePeriodInterest(capital, rate);
    
    // Move any existing current interest to overdue if there was already current interest
    const existingCurrent = parseFloat(loan.currentInterest);
    const existingOverdue = parseFloat(loan.overdueInterest);
    
    let newOverdue = existingOverdue;
    let newCurrent = interest;
    
    if (existingCurrent > 0) {
      // Previous interest was not paid — move to overdue
      newOverdue = existingOverdue + existingCurrent;
    }
    
    // Calculate next cut date
    const nextCut = nextCutDate(new Date(loan.nextCutDate), loan.periodicity);
    
    await db.update(loansTable).set({
      currentInterest: newCurrent.toFixed(2),
      overdueInterest: newOverdue.toFixed(2),
      nextCutDate: nextCut.toISOString().slice(0, 10),
      lastInterestDate: todayStr,
      inDefault: newOverdue > 0,
    }).where(eq(loansTable.id, loan.id));
    
    // Record movement
    await db.insert(movementsTable).values({
      loanId: loan.id,
      type: "interest_accrual",
      amount: interest.toFixed(2),
      concept: `Interés generado: ${(rate * 100).toFixed(1)}% sobre capital ${capital.toFixed(2)}`,
      date: todayStr,
    });
    
    processed++;
  }
  
  await logAudit(req, "INTEREST_CALCULATION", "system", null, null, { processed, date: todayStr });
  res.json({ success: true, message: `Intereses calculados para ${processed} préstamos` });
});

export default router;
