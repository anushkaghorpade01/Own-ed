/**
 * Pre-opening timeline — rent and fit-out cash before first class.
 * Forecast month 1 = lease / funding start; classes begin after preOpeningMonths.
 */

import { d, sum, trace } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import type { CapexResult, OperatingExpensesResult } from "./costs";
import { calculateOperatingExpenses } from "./costs";
import Decimal from "decimal.js";

export type PreOpeningOpexMode = "minimal" | "full";

export function getPreOpeningMonths(assumptions: FinanceAssumptions): number {
  return Math.max(0, assumptions.preOpeningMonths ?? 0);
}

export function isPreOpeningMonth(
  assumptions: FinanceAssumptions,
  forecastMonth: number
): boolean {
  const pre = getPreOpeningMonths(assumptions);
  return pre > 0 && forecastMonth <= pre;
}

/** First forecast month with classes (ramp-up starts here). */
export function getFirstOperatingMonth(assumptions: FinanceAssumptions): number {
  return getPreOpeningMonths(assumptions) + 1;
}

/** Month index for ramp curve — 0 during pre-opening, then 1-based operating months. */
export function toOperatingMonth(
  assumptions: FinanceAssumptions,
  forecastMonth: number
): number {
  if (isPreOpeningMonth(assumptions, forecastMonth)) return 0;
  return forecastMonth - getPreOpeningMonths(assumptions);
}

export interface MonthlyCapexPayment {
  nonRecoverable: Decimal;
  deposit: Decimal;
}

export function buildCapexPaymentSchedule(
  assumptions: FinanceAssumptions,
  capex: CapexResult
): Map<number, MonthlyCapexPayment> {
  const schedule = new Map<number, MonthlyCapexPayment>();
  const add = (month: number, nonRecoverable: Decimal, deposit: Decimal) => {
    const existing = schedule.get(month) ?? {
      nonRecoverable: new Decimal(0),
      deposit: new Decimal(0),
    };
    schedule.set(month, {
      nonRecoverable: existing.nonRecoverable.plus(nonRecoverable),
      deposit: existing.deposit.plus(deposit),
    });
  };

  const pre = getPreOpeningMonths(assumptions);
  const interior = d(assumptions.capexInteriorFitout);
  const deposit = capex.recoverableDeposits;
  const totalNonRec = capex.nonRecoverableCapex;
  const equipmentAndOther = Decimal.max(0, totalNonRec.minus(interior));

  if (pre === 0) {
    add(1, totalNonRec, deposit);
    return schedule;
  }

  add(1, new Decimal(0), deposit);

  if (interior.gt(0)) {
    const perMonth = interior.dividedBy(pre);
    let allocated = new Decimal(0);
    for (let month = 1; month <= pre; month++) {
      const chunk =
        month === pre ? interior.minus(allocated) : perMonth;
      allocated = allocated.plus(chunk);
      add(month, chunk, new Decimal(0));
    }
  }

  const openMonth = pre + 1;
  add(openMonth, equipmentAndOther, new Decimal(0));
  return schedule;
}

export function getCapexPaymentForMonth(
  assumptions: FinanceAssumptions,
  capex: CapexResult,
  month: number
): MonthlyCapexPayment {
  const schedule = buildCapexPaymentSchedule(assumptions, capex);
  return (
    schedule.get(month) ?? {
      nonRecoverable: new Decimal(0),
      deposit: new Decimal(0),
    }
  );
}

/** Cash paid out in forecast month 1 (deposit + any capex scheduled that month). */
export function getInitialCashPaidOut(
  assumptions: FinanceAssumptions,
  capex: CapexResult
): Decimal {
  const month1 = getCapexPaymentForMonth(assumptions, capex, 1);
  return month1.nonRecoverable.plus(month1.deposit);
}

/** Operating expenses while the studio is not yet open for classes. */
export function calculatePreOpeningOperatingExpenses(
  assumptions: FinanceAssumptions
): OperatingExpensesResult {
  const mode: PreOpeningOpexMode = assumptions.preOpeningOpexMode ?? "minimal";
  if (mode === "full") {
    return calculateOperatingExpenses(assumptions, new Decimal(0));
  }

  const rent = d(assumptions.rent);
  const camMaintenance = d(assumptions.camMaintenance);
  const utilities = d(assumptions.electricityBase);
  const totalOperatingExpenses = sum([rent, camMaintenance, utilities]);

  return {
    rent,
    camMaintenance,
    utilities,
    ownerSalary: new Decimal(0),
    instructorSalaries: new Decimal(0),
    cleanerSalary: new Decimal(0),
    receptionSalary: new Decimal(0),
    security: new Decimal(0),
    internet: new Decimal(0),
    softwareSubscriptions: new Decimal(0),
    accounting: new Decimal(0),
    insurance: new Decimal(0),
    marketing: new Decimal(0),
    licences: new Decimal(0),
    otherFixed: new Decimal(0),
    laundry: new Decimal(0),
    water: new Decimal(0),
    cleaningSupplies: new Decimal(0),
    refreshments: new Decimal(0),
    customerAcquisition: new Decimal(0),
    repairsReserve: new Decimal(0),
    miscVariable: new Decimal(0),
    totalOperatingExpenses,
    totalFixedCosts: totalOperatingExpenses,
    trace: trace(
      "Pre-opening operating expenses",
      "Rent + CAM + base utilities (minimal mode)",
      "INR/month",
      [{ label: "Total", expression: "Σ pre-opening line items", result: totalOperatingExpenses }],
      totalOperatingExpenses
    ),
  };
}
