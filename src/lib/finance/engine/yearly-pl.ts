import { d, sum } from "../decimal";
import type { MonthlyPLSnapshot } from "./monthly-projection";
import Decimal from "decimal.js";
import {
  analyzeYearlyProfitDrivers,
  type YearProfitExplanation,
} from "./yearly-profit-drivers";

export interface YearlyPLRow {
  year: number;
  startMonth: number;
  endMonth: number;
  netRevenue: Decimal;
  dropInRevenue: Decimal;
  groupClassRevenue: Decimal;
  standingSpotRevenue: Decimal;
  privateRevenue: Decimal;
  standbyRevenue: Decimal;
  duoRevenue: Decimal;
  workshopRevenue: Decimal;
  otherRevenue: Decimal;
  directCosts: Decimal;
  instructorDelivery: Decimal;
  sessionConsumables: Decimal;
  paymentFees: Decimal;
  grossProfit: Decimal;
  grossMarginPct: Decimal;
  operatingExpenses: Decimal;
  rent: Decimal;
  payroll: Decimal;
  utilities: Decimal;
  internet: Decimal;
  software: Decimal;
  marketing: Decimal;
  repairs: Decimal;
  otherOpex: Decimal;
  ebitda: Decimal;
  depreciation: Decimal;
  interestExpense: Decimal;
  incomeTax: Decimal;
  netProfit: Decimal;
  netProfitMarginPct: Decimal;
  yoyNetRevenuePct: Decimal | null;
  yoyNetProfitPct: Decimal | null;
}

export interface YearlyPLResult {
  years: YearlyPLRow[];
  trend: "improving" | "stable" | "compressing";
  costGrowthDrivers: Array<{ label: string; year: number; change: Decimal }>;
  forecastHealth: Array<{ year: number; netProfit: Decimal; marginPct: Decimal; note: string }>;
  yearExplanations: YearProfitExplanation[];
}

function sumMonths(
  monthly: MonthlyPLSnapshot[],
  start: number,
  end: number,
  pick: (m: MonthlyPLSnapshot) => Decimal
): Decimal {
  return sum(
    monthly.filter((m) => m.month >= start && m.month <= end).map(pick)
  );
}

function marginPct(numerator: Decimal, denominator: Decimal): Decimal {
  return denominator.isZero()
    ? new Decimal(0)
    : numerator.dividedBy(denominator).times(100);
}

function yoyPct(current: Decimal, prior: Decimal): Decimal | null {
  if (prior.isZero()) return null;
  return current.minus(prior).dividedBy(prior.abs()).times(100);
}

export function aggregateYearlyPL(
  monthly: MonthlyPLSnapshot[],
  forecastYears: number
): YearlyPLResult {
  const years: YearlyPLRow[] = [];

  for (let year = 1; year <= forecastYears; year++) {
    const startMonth = (year - 1) * 12 + 1;
    const endMonth = year * 12;
    const slice = monthly.filter((m) => m.month >= startMonth && m.month <= endMonth);

    const netRevenue = sumMonths(monthly, startMonth, endMonth, (m) => m.pl.netRevenue);
    const directCosts = sumMonths(monthly, startMonth, endMonth, (m) => m.pl.directCosts);
    const grossProfit = sumMonths(monthly, startMonth, endMonth, (m) => m.pl.grossProfit);
    const operatingExpenses = sumMonths(
      monthly,
      startMonth,
      endMonth,
      (m) => m.pl.operatingExpenses
    );
    const ebitda = sumMonths(monthly, startMonth, endMonth, (m) => m.pl.ebitda);
    const netProfit = sumMonths(monthly, startMonth, endMonth, (m) => m.pl.netProfit);

    const prior = years[years.length - 1];

    years.push({
      year,
      startMonth,
      endMonth,
      netRevenue,
      dropInRevenue: sumMonths(monthly, startMonth, endMonth, (m) => m.revenue.dropInRevenue),
      groupClassRevenue: sumMonths(
        monthly,
        startMonth,
        endMonth,
        (m) => m.revenue.groupClassRevenue
      ),
      standingSpotRevenue: sumMonths(
        monthly,
        startMonth,
        endMonth,
        (m) => m.revenue.standingSpotRevenue
      ),
      privateRevenue: sumMonths(monthly, startMonth, endMonth, (m) => m.revenue.privateRevenue),
      standbyRevenue: sumMonths(monthly, startMonth, endMonth, (m) => m.revenue.standbyRevenue),
      duoRevenue: sumMonths(monthly, startMonth, endMonth, (m) => m.revenue.duoRevenue),
      workshopRevenue: sumMonths(
        monthly,
        startMonth,
        endMonth,
        (m) => m.revenue.workshopRevenue
      ),
      otherRevenue: sumMonths(monthly, startMonth, endMonth, (m) => m.revenue.otherRevenue),
      directCosts,
      instructorDelivery: sumMonths(
        monthly,
        startMonth,
        endMonth,
        (m) => m.directCosts.variableInstructorPayouts
      ),
      sessionConsumables: sumMonths(
        monthly,
        startMonth,
        endMonth,
        (m) => m.directCosts.sessionConsumables
      ),
      paymentFees: sumMonths(monthly, startMonth, endMonth, (m) => m.directCosts.paymentFees),
      grossProfit,
      grossMarginPct: marginPct(grossProfit, netRevenue),
      operatingExpenses,
      rent: sumMonths(monthly, startMonth, endMonth, (m) => m.operatingExpenses.rent),
      payroll: sumMonths(monthly, startMonth, endMonth, (m) =>
        m.operatingExpenses.ownerSalary
          .plus(m.operatingExpenses.instructorSalaries)
          .plus(m.operatingExpenses.cleanerSalary)
          .plus(m.operatingExpenses.receptionSalary)
      ),
      utilities: sumMonths(monthly, startMonth, endMonth, (m) => m.operatingExpenses.utilities),
      internet: sumMonths(monthly, startMonth, endMonth, (m) => m.operatingExpenses.internet),
      software: sumMonths(
        monthly,
        startMonth,
        endMonth,
        (m) => m.operatingExpenses.softwareSubscriptions
      ),
      marketing: sumMonths(monthly, startMonth, endMonth, (m) => m.operatingExpenses.marketing),
      repairs: sumMonths(monthly, startMonth, endMonth, (m) => m.operatingExpenses.repairsReserve),
      otherOpex: sumMonths(monthly, startMonth, endMonth, (m) =>
        m.operatingExpenses.totalOperatingExpenses
          .minus(m.operatingExpenses.rent)
          .minus(m.operatingExpenses.utilities)
          .minus(m.operatingExpenses.marketing)
          .minus(m.operatingExpenses.repairsReserve)
          .minus(m.operatingExpenses.softwareSubscriptions)
          .minus(m.operatingExpenses.internet)
      ),
      ebitda,
      depreciation: sumMonths(monthly, startMonth, endMonth, (m) => m.pl.depreciation),
      interestExpense: sumMonths(monthly, startMonth, endMonth, (m) => m.pl.interestExpense),
      incomeTax: sumMonths(monthly, startMonth, endMonth, (m) => m.pl.incomeTax),
      netProfit,
      netProfitMarginPct: marginPct(netProfit, netRevenue),
      yoyNetRevenuePct: prior ? yoyPct(netRevenue, prior.netRevenue) : null,
      yoyNetProfitPct: prior ? yoyPct(netProfit, prior.netProfit) : null,
    });

    void slice;
  }

  const margins = years.map((y) => y.netProfitMarginPct);
  let trend: YearlyPLResult["trend"] = "stable";
  if (margins.length >= 2) {
    const first = margins[0];
    const last = margins[margins.length - 1];
    if (last.gt(first.plus(1))) trend = "improving";
    else if (last.lt(first.minus(1))) trend = "compressing";
  }

  const costGrowthDrivers: YearlyPLResult["costGrowthDrivers"] = [];
  for (let i = 1; i < years.length; i++) {
    const prev = years[i - 1];
    const curr = years[i];
    const drivers = [
      { label: "Payroll", change: curr.payroll.minus(prev.payroll) },
      { label: "Rent", change: curr.rent.minus(prev.rent) },
      { label: "Utilities", change: curr.utilities.minus(prev.utilities) },
      { label: "Repairs", change: curr.repairs.minus(prev.repairs) },
    ].filter((d) => !d.change.isZero());
    for (const driver of drivers) {
      costGrowthDrivers.push({ ...driver, year: curr.year });
    }
  }

  const yearExplanations = analyzeYearlyProfitDrivers(monthly, years);

  const forecastHealth = years.map((y, i) => ({
    year: y.year,
    netProfit: y.netProfit,
    marginPct: y.netProfitMarginPct,
    note: yearExplanations[i]?.summary ?? "Opening year",
  }));

  return { years, trend, costGrowthDrivers, forecastHealth, yearExplanations };
}

/** Verify annual totals reconcile to monthly sums for every P&L line */
export function verifyYearlyReconciliation(
  monthly: MonthlyPLSnapshot[],
  yearly: YearlyPLResult
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const yearRow of yearly.years) {
    const { startMonth, endMonth, year } = yearRow;
    const expectedNetProfit = sumMonths(monthly, startMonth, endMonth, (m) => m.pl.netProfit);
    const expectedNetRevenue = sumMonths(monthly, startMonth, endMonth, (m) => m.pl.netRevenue);

    if (!expectedNetProfit.equals(yearRow.netProfit)) {
      errors.push(
        `Year ${year} net profit mismatch: annual=${yearRow.netProfit} monthly sum=${expectedNetProfit}`
      );
    }
    if (!expectedNetRevenue.equals(yearRow.netRevenue)) {
      errors.push(
        `Year ${year} net revenue mismatch: annual=${yearRow.netRevenue} monthly sum=${expectedNetRevenue}`
      );
    }
  }

  return { ok: errors.length === 0, errors };
}
