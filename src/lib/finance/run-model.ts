import { calculateCapacity } from "./engine/capacity";
import { calculateRevenue } from "./engine/revenue";
import {
  calculateDirectCosts,
  calculateOperatingExpenses,
  calculateCapex,
} from "./engine/costs";
import { calculatePL } from "./engine/pl";
import { calculateCashFlow } from "./engine/cash-flow";
import { resolveMonthAssumptions } from "./engine/forecast-timeline";
import { runMonthlyProjection } from "./engine/monthly-projection";
import { aggregateYearlyPL, type YearlyPLResult } from "./engine/yearly-pl";
import {
  calculateUnitEconomics,
  calculateCreditLiability,
  calculateUnusedCapacityAnalysis,
} from "./engine/unit-economics";
import { calculateBreakEven, calculatePayback } from "./engine/break-even";
import { calculateAccessProducts } from "./engine/access-products";
import { validateAssumptions, normalizeAssumptions } from "./validation";
import { resolveForecastSettings } from "./engine/escalation";
import { d, WEEKS_PER_MONTH } from "./decimal";
import type { FinanceAssumptions } from "./schemas";
import Decimal from "decimal.js";

export interface FinanceModelOutput {
  assumptions: FinanceAssumptions;
  validationErrors: ReturnType<typeof validateAssumptions>;
  capacity: ReturnType<typeof calculateCapacity>;
  revenue: ReturnType<typeof calculateRevenue>;
  directCosts: ReturnType<typeof calculateDirectCosts>;
  operatingExpenses: ReturnType<typeof calculateOperatingExpenses>;
  pl: ReturnType<typeof calculatePL>;
  unitEconomics: ReturnType<typeof calculateUnitEconomics>;
  creditLiability: ReturnType<typeof calculateCreditLiability>;
  unusedCapacity: ReturnType<typeof calculateUnusedCapacityAnalysis>;
  accessProducts: ReturnType<typeof calculateAccessProducts>;
  capex: ReturnType<typeof calculateCapex>;
  cashFlow: ReturnType<typeof calculateCashFlow>;
  breakEven: ReturnType<typeof calculateBreakEven>;
  payback: ReturnType<typeof calculatePayback>;
  monthlyProjection: ReturnType<typeof runMonthlyProjection>;
  yearlyPL: YearlyPLResult;
  summary: {
    launchInvestment: Decimal;
    monthlyRevenue: Decimal;
    monthlyOperatingProfit: Decimal;
    breakEvenOccupancyPct: Decimal;
    paybackMonths: number | null;
    reformers: number;
    weeklyClasses: Decimal;
    utilisationPct: Decimal;
  };
}

function computeMonthInternals(
  assumptions: FinanceAssumptions,
  occupancy: Decimal,
  month?: number
) {
  const base =
    month !== undefined
      ? normalizeAssumptions(resolveMonthAssumptions(assumptions, month))
      : normalizeAssumptions(assumptions);
  const capacity = calculateCapacity(base, occupancy);
  const classesPerMonth = capacity.weeklyClasses.times(WEEKS_PER_MONTH);
  const bookedPct =
    month !== undefined
      ? occupancy.times(100).toNumber()
      : base.projectedBookedOccupancyPct;
  const revenue = calculateRevenue(base, capacity.occupiedSeatsMonthly, {
    bookedOccupancyPct: bookedPct,
  });
  const directCosts = calculateDirectCosts(
    base,
    capacity.attendedSeatsMonthly,
    classesPerMonth,
    revenue.grossCustomerBillings
  );
  const operatingExpenses = calculateOperatingExpenses(base, classesPerMonth);
  const pl = calculatePL(base, revenue, directCosts, operatingExpenses);

  return {
    revenue,
    directCosts,
    operatingExpenses,
    netProfit: pl.netProfit,
    ebitda: pl.ebitda,
    attendedSeats: capacity.attendedSeatsMonthly,
    classesPerMonth,
    capacity,
    pl,
  };
}

export function runFinanceModel(
  assumptions: FinanceAssumptions
): FinanceModelOutput {
  const safe = normalizeAssumptions(assumptions);
  const validationErrors = validateAssumptions(safe);
  const occupancy = d(safe.projectedBookedOccupancyPct).dividedBy(100);
  const monthResult = computeMonthInternals(safe, occupancy);

  const {
    capacity,
    revenue,
    directCosts,
    operatingExpenses,
    pl,
  } = monthResult;

  const unitEconomics = calculateUnitEconomics(
    safe,
    revenue,
    directCosts,
    operatingExpenses,
    capacity.attendedSeatsMonthly,
    capacity.monthlyAvailableSeats
  );

  const capex = calculateCapex(safe);

  const forecast = resolveForecastSettings(safe);
  const monthlyProjection = runMonthlyProjection(safe);
  const yearlyPL = aggregateYearlyPL(monthlyProjection, forecast.forecastYears);

  const cashFlow = calculateCashFlow(
    safe,
    (a, occ, month) => {
      const r = computeMonthInternals(a, occ, month);
      return {
        revenue: r.revenue,
        directCosts: r.directCosts,
        operatingExpenses: r.operatingExpenses,
        netProfit: r.pl.netProfit,
        ebitda: r.pl.ebitda,
        attendedSeats: r.capacity.attendedSeatsMonthly,
        classesPerMonth: r.capacity.weeklyClasses.times(WEEKS_PER_MONTH),
      };
    },
    capex,
    forecast.forecastYears * 12,
    monthlyProjection.map((m) => ({
      revenue: m.revenue,
      directCosts: m.directCosts,
      operatingExpenses: m.operatingExpenses,
      netProfit: m.pl.netProfit,
      ebitda: m.pl.ebitda,
    }))
  );

  const breakEven = calculateBreakEven(
    safe,
    unitEconomics,
    operatingExpenses,
    capacity.monthlyAvailableSeats,
    pl.ebitda,
    d(safe.projectedBookedOccupancyPct),
    cashFlow.operatingCashBreakEvenMonth,
    cashFlow.cumulativeCashBreakEvenMonth
  );

  const payback = calculatePayback(
    capex.nonRecoverableCapex,
    capex.recoverableDeposits,
    d(safe.workingCapital),
    safe.includeRecoverableDepositInPayback,
    [
      { month: 0, cumulative: cashFlow.initialInvestment.negated() },
      ...cashFlow.monthly.map((m) => ({
        month: m.month,
        cumulative: m.recoveryPosition,
      })),
    ]
  );

  const utilisationPct = capacity.monthlyAvailableSeats.isZero()
    ? new Decimal(0)
    : capacity.occupiedSeatsMonthly
        .dividedBy(capacity.monthlyAvailableSeats)
        .times(100);

  return {
    assumptions: safe,
    validationErrors,
    capacity,
    revenue,
    directCosts,
    operatingExpenses,
    pl,
    unitEconomics,
    creditLiability: calculateCreditLiability(
      safe,
      capacity.monthlyAvailableSeats,
      capacity.occupiedSeatsMonthly,
      safe.peakSlotsShareOfCapacityPct,
      revenue.commercialPackSales
    ),
    unusedCapacity: calculateUnusedCapacityAnalysis(
      safe,
      capacity.monthlyAvailableSeats,
      capacity.occupiedSeatsMonthly,
      revenue.weightedRevenue.weightedNetRevenuePerCredit
    ),
    accessProducts: calculateAccessProducts(safe, capacity),
    capex,
    cashFlow,
    breakEven,
    payback,
    monthlyProjection,
    yearlyPL,
    summary: {
      launchInvestment: capex.nonRecoverableCapex.plus(d(safe.workingCapital)),
      monthlyRevenue: revenue.netRevenue,
      monthlyOperatingProfit: pl.ebitda,
      breakEvenOccupancyPct: breakEven.contributionBreakEven.breakEvenOccupancyPct,
      paybackMonths: payback.paybackMonth,
      reformers: safe.reformers,
      weeklyClasses: capacity.weeklyClasses,
      utilisationPct,
    },
  };
}
