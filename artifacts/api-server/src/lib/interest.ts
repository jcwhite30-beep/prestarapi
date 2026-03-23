// PrestaRapi Interest Engine

export interface LoanData {
  id: number;
  currentCapital: number;
  rate: number;
  periodicity: string;
  disbursementDate: string | null;
  lastInterestDate: string | null;
  nextCutDate: string | null;
  overdueInterest: number;
  currentInterest: number;
  status: string;
}

export interface AgencyConfig {
  graceDaysDisbursement: number;
  graceDaysPayment: number;
}

/**
 * Calculate next cut date based on periodicity from a given date
 */
export function nextCutDate(fromDate: Date, periodicity: string): Date {
  const d = new Date(fromDate);
  switch (periodicity) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly": {
      const day = d.getDate();
      const month = d.getMonth();
      const year = d.getFullYear();
      if (day < 15) {
        return new Date(year, month, 15);
      } else {
        // Last day of month
        return new Date(year, month + 1, 0);
      }
    }
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    default:
      d.setDate(d.getDate() + 15);
  }
  return d;
}

/**
 * Calculate first cut date after disbursement
 */
export function firstCutAfterDisbursement(disbursementDate: Date, periodicity: string): Date {
  return nextCutDate(disbursementDate, periodicity);
}

/**
 * Apply interest calculation for a period
 * Returns interest amount to add
 */
export function calculatePeriodInterest(capital: number, rate: number): number {
  return Math.round(capital * rate * 100) / 100;
}

/**
 * Apply payment to loan following hierarchy:
 * 1. Overdue interest
 * 2. Current interest
 * 3. Capital
 */
export interface PaymentApplication {
  appliedOverdue: number;
  appliedCurrent: number;
  appliedCapital: number;
  remainingOverdue: number;
  remainingCurrent: number;
  remainingCapital: number;
}

export function applyPayment(
  amount: number,
  overdueInterest: number,
  currentInterest: number,
  capital: number,
  forgivenInterest: number = 0,
  forgivenCapital: number = 0
): PaymentApplication {
  // Apply forgiveness first
  const effectiveOverdue = Math.max(0, overdueInterest - forgivenInterest);
  const effectiveCurrent = Math.max(0, currentInterest - Math.max(0, forgivenInterest - overdueInterest));
  const effectiveCapital = Math.max(0, capital - forgivenCapital);

  let remaining = amount;

  // 1. Overdue interest
  const appliedOverdue = Math.min(remaining, effectiveOverdue);
  remaining -= appliedOverdue;

  // 2. Current interest
  const appliedCurrent = Math.min(remaining, effectiveCurrent);
  remaining -= appliedCurrent;

  // 3. Capital
  const appliedCapital = Math.min(remaining, effectiveCapital);

  return {
    appliedOverdue,
    appliedCurrent,
    appliedCapital,
    remainingOverdue: effectiveOverdue - appliedOverdue,
    remainingCurrent: effectiveCurrent - appliedCurrent,
    remainingCapital: effectiveCapital - appliedCapital,
  };
}

/**
 * Check if a date is within the grace period
 */
export function isInGracePeriod(referenceDate: Date, graceDays: number, checkDate: Date): boolean {
  const graceEnd = new Date(referenceDate);
  graceEnd.setDate(graceEnd.getDate() + graceDays);
  return checkDate <= graceEnd;
}

/**
 * Calculate upcoming cuts for next N days
 */
export function getUpcomingCuts(loans: LoanData[], days: number = 7): Array<{ loanId: number; cutDate: Date }> {
  const now = new Date();
  const limit = new Date();
  limit.setDate(limit.getDate() + days);

  return loans
    .filter((l) => l.status === "active" && l.nextCutDate)
    .map((l) => ({ loanId: l.id, cutDate: new Date(l.nextCutDate!) }))
    .filter((c) => c.cutDate >= now && c.cutDate <= limit)
    .sort((a, b) => a.cutDate.getTime() - b.cutDate.getTime());
}
