import { getRampUpOccupancy } from "./cash-flow";
import { getForecastHorizonMonths, resolveForecastSettings } from "./escalation";
import {
  resolveMonthAssumptions,
  captureStructuralSnapshot,
  type MonthStructuralSnapshot,
} from "./forecast-timeline";
import { calculateCapacity } from "./capacity";
import { calculateRevenue } from "./revenue";
import { calculateDirectCosts, calculateOperatingExpenses } from "./costs";
import { calculatePL, type PLResult } from "./pl";
import { normalizeAssumptions } from "../validation";
import { WEEKS_PER_MONTH } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import type { RevenueResult } from "./revenue";
import type { DirectCostsResult, OperatingExpensesResult } from "./costs";
import Decimal from "decimal.js";

export interface MonthlyPLSnapshot {
  month: number;
  occupancyPct: Decimal;
  revenue: RevenueResult;
  directCosts: DirectCostsResult;
  operatingExpenses: OperatingExpensesResult;
  pl: PLResult;
  structural: MonthStructuralSnapshot;
}

export function computeMonthSnapshot(
  baseAssumptions: FinanceAssumptions,
  month: number
): MonthlyPLSnapshot {
  const monthAssumptions = normalizeAssumptions(
    resolveMonthAssumptions(baseAssumptions, month)
  );
  const occupancy = getRampUpOccupancy(baseAssumptions, month);
  const capacity = calculateCapacity(monthAssumptions, occupancy);
  const classesPerMonth = capacity.weeklyClasses.times(WEEKS_PER_MONTH);
  const revenue = calculateRevenue(monthAssumptions, capacity.occupiedSeatsMonthly);
  const directCosts = calculateDirectCosts(
    monthAssumptions,
    capacity.attendedSeatsMonthly,
    classesPerMonth,
    revenue.grossCustomerBillings
  );
  const operatingExpenses = calculateOperatingExpenses(monthAssumptions, classesPerMonth);
  const pl = calculatePL(monthAssumptions, revenue, directCosts, operatingExpenses);

  const forecast = resolveForecastSettings(baseAssumptions);
  const structural = captureStructuralSnapshot(
    monthAssumptions,
    capacity.monthlyAvailableSeats.toNumber(),
    forecast.forecastTimeline,
    month
  );

  return {
    month,
    occupancyPct: occupancy.times(100),
    revenue,
    directCosts,
    operatingExpenses,
    pl,
    structural,
  };
}

export function runMonthlyProjection(
  assumptions: FinanceAssumptions,
  horizonMonths?: number
): MonthlyPLSnapshot[] {
  const safe = normalizeAssumptions(assumptions);
  const months = horizonMonths ?? getForecastHorizonMonths(safe);
  const snapshots: MonthlyPLSnapshot[] = [];

  for (let month = 1; month <= months; month++) {
    snapshots.push(computeMonthSnapshot(safe, month));
  }

  return snapshots;
}
