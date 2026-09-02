import { d, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import type { UnitEconomicsResult } from "./unit-economics";
import type { OperatingExpensesResult } from "./costs";
import Decimal from "decimal.js";

export interface BreakEvenResult {
  contributionBreakEven: {
    requiredOccupiedSeats: Decimal;
    breakEvenOccupancyPct: Decimal;
    trace: CalculationTrace;
  };
  ebitdaBreakEvenOccupancyPct: Decimal;
  cashBreakEvenMonth: number | null;
  cumulativeCashBreakEvenMonth: number | null;
}

export function calculateBreakEven(
  assumptions: FinanceAssumptions,
  unitEconomics: UnitEconomicsResult,
  operatingExpenses: OperatingExpensesResult,
  monthlyAvailableSeats: Decimal,
  ebitdaAtCurrentOccupancy: Decimal,
  currentOccupancyPct: Decimal,
  cashBreakEvenMonth: number | null,
  cumulativeCashBreakEvenMonth: number | null
): BreakEvenResult {
  const contributionPerSeat = unitEconomics.perSeat.contributionMarginPerSeat;
  const fixedCosts = operatingExpenses.totalFixedCosts;

  const requiredOccupiedSeats = contributionPerSeat.isZero()
    ? new Decimal(Infinity)
    : fixedCosts.dividedBy(contributionPerSeat);

  const breakEvenOccupancyPct = monthlyAvailableSeats.isZero()
    ? new Decimal(0)
    : requiredOccupiedSeats.dividedBy(monthlyAvailableSeats).times(100);

  // EBITDA break-even: linear model — EBITDA(occ) = occ% × seats × contrib/seat − total opex
  const contributionAtFullCapacity = monthlyAvailableSeats.times(contributionPerSeat);
  const ebitdaBreakEvenOccupancyPct =
    contributionAtFullCapacity.isZero()
      ? new Decimal(100)
      : Decimal.min(
          operatingExpenses.totalOperatingExpenses
            .dividedBy(contributionAtFullCapacity)
            .times(100),
          new Decimal(100)
        );

  const contributionTrace = trace(
    "Contribution break-even occupancy",
    "Fixed operating costs / weighted contribution per occupied seat, then ÷ available seats",
    "%",
    [
      { label: "Fixed costs", expression: fixedCosts.toString(), result: fixedCosts },
      { label: "Contribution/seat", expression: contributionPerSeat.toString(), result: contributionPerSeat },
      { label: "Required seats", expression: `${fixedCosts} / ${contributionPerSeat}`, result: requiredOccupiedSeats },
      { label: "Available seats", expression: monthlyAvailableSeats.toString(), result: monthlyAvailableSeats },
      { label: "Break-even occupancy", expression: `${requiredOccupiedSeats} / ${monthlyAvailableSeats} × 100`, result: breakEvenOccupancyPct },
    ],
    breakEvenOccupancyPct
  );

  return {
    contributionBreakEven: {
      requiredOccupiedSeats,
      breakEvenOccupancyPct,
      trace: contributionTrace,
    },
    ebitdaBreakEvenOccupancyPct,
    cashBreakEvenMonth,
    cumulativeCashBreakEvenMonth,
  };
}

export interface PaybackResult {
  paybackMonth: number | null;
  /** Fractional month estimate when recovery crosses zero between months */
  paybackMonthEstimate: number | null;
  paybackNotReached: boolean;
  initialInvestment: Decimal;
  nonRecoverableInvestment: Decimal;
  recoverableDeposits: Decimal;
  workingCapital: Decimal;
  roi12Months: Decimal;
  roi24Months: Decimal;
  roi36Months: Decimal;
  cumulativeCashSeries: Array<{ month: number; cumulative: Decimal }>;
  trace: CalculationTrace;
}

export function calculatePayback(
  nonRecoverableInvestment: Decimal,
  recoverableDeposits: Decimal,
  workingCapital: Decimal,
  includeRecoverable: boolean,
  cumulativeCashSeries: Array<{ month: number; cumulative: Decimal }>
): PaybackResult {
  const invested = includeRecoverable
    ? nonRecoverableInvestment.plus(recoverableDeposits).plus(workingCapital)
    : nonRecoverableInvestment.plus(workingCapital);

  let paybackMonth: number | null = null;
  let paybackMonthEstimate: number | null = null;

  for (let i = 0; i < cumulativeCashSeries.length; i++) {
    const point = cumulativeCashSeries[i];
    if (point.month === 0) continue;
    if (point.cumulative.gte(0)) {
      paybackMonth = point.month;
      const prior = cumulativeCashSeries[i - 1];
      if (prior && prior.cumulative.lt(0) && !point.cumulative.eq(prior.cumulative)) {
        const gap = point.cumulative.minus(prior.cumulative);
        const fraction = point.cumulative.dividedBy(gap);
        paybackMonthEstimate =
          Math.round((prior.month + fraction.toNumber()) * 10) / 10;
      } else {
        paybackMonthEstimate = point.month;
      }
      break;
    }
  }

  const roi = (month: number) => {
    const point = cumulativeCashSeries.find((p) => p.month === month);
    if (!point || invested.isZero()) return new Decimal(0);
    return point.cumulative.dividedBy(invested).times(100);
  };

  return {
    paybackMonth,
    paybackMonthEstimate,
    paybackNotReached: paybackMonth === null,
    initialInvestment: invested,
    nonRecoverableInvestment: nonRecoverableInvestment,
    recoverableDeposits,
    workingCapital,
    roi12Months: roi(12),
    roi24Months: roi(24),
    roi36Months: roi(36),
    cumulativeCashSeries,
    trace: trace(
      "Investment payback",
      "Month when cumulative operating cash recovers the payback investment base (non-recoverable capex + working capital, optional deposit)",
      "months",
      [
        { label: "Payback investment base", expression: invested.toString(), result: invested },
        {
          label: "Payback month",
          expression: paybackMonth
            ? paybackMonthEstimate && paybackMonthEstimate !== paybackMonth
              ? `~Month ${paybackMonthEstimate} (crosses in month ${paybackMonth})`
              : `Month ${paybackMonth}`
            : "Not reached within horizon",
          result: d(paybackMonthEstimate ?? paybackMonth ?? 0),
        },
      ],
      d(paybackMonthEstimate ?? paybackMonth ?? 0)
    ),
  };
}

export function sensitivityMatrix(
  assumptions: FinanceAssumptions,
  computeEbitda: (occupancyPct: number, netPrice: number) => Decimal,
  occupancyRows: number[],
  priceColumns: number[]
): Decimal[][] {
  return occupancyRows.map((occ) =>
    priceColumns.map((price) => computeEbitda(occ, price))
  );
}
