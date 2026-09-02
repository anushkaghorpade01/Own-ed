import { d, sum, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import type { RevenueResult } from "./revenue";
import type { DirectCostsResult, OperatingExpensesResult, CapexResult } from "./costs";
import { calculateLoanPayment } from "./costs";
import { OPERATING_CASH_INFLOW_BASIS } from "../cash-basis";
import { calculateOperatingCashInflows } from "./prepaid-cash";
import {
  buildLaunchCashBreakdown,
  buildCashHealthSummary,
  getFundingInflowsForMonth,
  recoveryPositionFromParts,
  type LaunchCashBreakdown,
  type CashHealthSummary,
} from "./investment-recovery";
import Decimal from "decimal.js";

export interface BankCashMovements {
  founderEquity: Decimal;
  loanProceeds: Decimal;
  additionalFunding: Decimal;
  capexPaid: Decimal;
  depositPaid: Decimal;
  loanRepayments: Decimal;
  operatingInflows: Decimal;
  operatingOutflows: Decimal;
  openingBankBeforeMonth: Decimal;
}

export interface MonthlyCashFlow {
  month: number;
  occupancyPct: Decimal;
  cashInflows: Decimal;
  cashOutflows: Decimal;
  netOperatingCashFlow: Decimal;
  capexOutflows: Decimal;
  financingInflows: Decimal;
  financingOutflows: Decimal;
  netCashFlow: Decimal;
  bankCashBalance: Decimal;
  /** @deprecated Use bankCashBalance */
  cumulativeCash: Decimal;
  /** cumulativeOperatingCashGenerated − paybackInvestmentBase */
  recoveryPosition: Decimal;
  /** @deprecated Use recoveryPosition */
  investmentRemaining: Decimal;
  /** @deprecated Use recoveryPosition */
  cumulativeFreeCashFlow: Decimal;
  cumulativeOperatingCashGenerated: Decimal;
  bankCashMovements?: BankCashMovements;
}

export interface CashFlowResult {
  monthly: MonthlyCashFlow[];
  lowestCashPoint: Decimal;
  lowestCashMonth: number;
  operatingCashBreakEvenMonth: number | null;
  /** @deprecated Use cashHealth.bankCashPositiveMonth */
  cumulativeCashBreakEvenMonth: number | null;
  initialInvestment: Decimal;
  launch: LaunchCashBreakdown;
  cashHealth: CashHealthSummary;
  inflowBasis: typeof OPERATING_CASH_INFLOW_BASIS.id;
  traces: Record<string, CalculationTrace>;
}

export function getRampUpOccupancy(
  assumptions: FinanceAssumptions,
  month: number
): Decimal {
  if (
    assumptions.rampUpMode === "manual" &&
    assumptions.rampUpCurve.length > 0
  ) {
    const entry = assumptions.rampUpCurve.find((r) => r.month === month);
    if (entry) return d(entry.occupancyPct).dividedBy(100);
    const last = assumptions.rampUpCurve[assumptions.rampUpCurve.length - 1];
    return d(last.occupancyPct).dividedBy(100);
  }

  const start = d(assumptions.rampUpStartingOccupancyPct).dividedBy(100);
  const target = d(assumptions.rampUpTargetOccupancyPct).dividedBy(100);
  const months = assumptions.rampUpMonthsToTarget;

  if (month >= months) return target;
  if (months <= 1) return target;

  const progress = d(month - 1).dividedBy(months - 1);
  return start.plus(target.minus(start).times(progress));
}

export function calculateCashFlow(
  assumptions: FinanceAssumptions,
  computeMonth: (
    assumptions: FinanceAssumptions,
    occupancy: Decimal,
    month: number
  ) => {
    revenue: RevenueResult;
    directCosts: DirectCostsResult;
    operatingExpenses: OperatingExpensesResult;
    netProfit: Decimal;
    ebitda: Decimal;
    attendedSeats: Decimal;
    classesPerMonth: Decimal;
  },
  capex: CapexResult,
  horizonMonths = 36,
  precomputedMonths?: Array<{
    revenue: RevenueResult;
    directCosts: DirectCostsResult;
    operatingExpenses: OperatingExpensesResult;
    netProfit: Decimal;
    ebitda: Decimal;
  }>
): CashFlowResult {
  const loanPayment = calculateLoanPayment(assumptions);
  const launch = buildLaunchCashBreakdown(assumptions, capex);
  const initialInvestment = launch.paybackInvestmentBase;

  let cumulativeOperatingCashGenerated = new Decimal(0);
  let lowestCashPoint = launch.openingBankCashAfterLaunch;
  let lowestCashMonth = 0;
  let operatingCashBreakEvenMonth: number | null = null;
  let cumulativeCashBreakEvenMonth: number | null = null;

  const monthly: MonthlyCashFlow[] = [];

  for (let month = 1; month <= horizonMonths; month++) {
    const occupancy = getRampUpOccupancy(assumptions, month);
    const monthResult =
      precomputedMonths?.[month - 1] ??
      computeMonth(assumptions, occupancy, month);

    const { grossInflows: cashInflows } = calculateOperatingCashInflows(
      assumptions,
      monthResult.revenue.grossCustomerBillings
    );
    const cashOutflows = sum([
      monthResult.operatingExpenses.totalOperatingExpenses,
      monthResult.directCosts.totalDirectCosts,
      monthResult.revenue.gstCollected,
    ]);

    const netOperatingCashFlow = cashInflows.minus(cashOutflows);
    cumulativeOperatingCashGenerated = cumulativeOperatingCashGenerated.plus(
      netOperatingCashFlow
    );

    const recoveryPosition = recoveryPositionFromParts(
      cumulativeOperatingCashGenerated,
      initialInvestment
    );

    const capexOutflows = month === 1 ? capex.nonRecoverableCapex : new Decimal(0);
    // Deposit is always a launch cash outflow — payback toggle affects hurdle only.
    const depositOutflow = month === 1 ? capex.recoverableDeposits : new Decimal(0);

    const fundingInflows = getFundingInflowsForMonth(assumptions, month);
    const financingOutflows =
      month > assumptions.loanGracePeriodMonths ? loanPayment : new Decimal(0);

    const netCashFlow = netOperatingCashFlow
      .minus(capexOutflows)
      .minus(depositOutflow)
      .plus(fundingInflows)
      .minus(financingOutflows);

    let bankCashBalance: Decimal;
    let bankCashMovements: BankCashMovements | undefined;

    if (month === 1) {
      const openingBankBeforeMonth = launch.openingBankCashAfterLaunch;
      bankCashBalance = openingBankBeforeMonth
        .plus(netOperatingCashFlow)
        .minus(financingOutflows);

      bankCashMovements = {
        founderEquity: d(assumptions.founderEquity),
        loanProceeds: d(assumptions.loanAmount),
        additionalFunding: fundingInflows
          .minus(d(assumptions.founderEquity))
          .minus(d(assumptions.loanAmount)),
        capexPaid: capex.nonRecoverableCapex,
        depositPaid: depositOutflow,
        loanRepayments: financingOutflows,
        operatingInflows: cashInflows,
        operatingOutflows: cashOutflows,
        openingBankBeforeMonth,
      };
    } else {
      const prior = monthly[month - 2].bankCashBalance;
      const extraFunding =
        month > 1 ? getFundingInflowsForMonth(assumptions, month) : new Decimal(0);
      bankCashBalance = prior
        .plus(extraFunding)
        .plus(netOperatingCashFlow)
        .minus(financingOutflows);
    }

    if (bankCashBalance.lt(lowestCashPoint)) {
      lowestCashPoint = bankCashBalance;
      lowestCashMonth = month;
    }
    if (launch.openingBankCashAfterLaunch.lt(lowestCashPoint)) {
      lowestCashPoint = launch.openingBankCashAfterLaunch;
      lowestCashMonth = 0;
    }

    if (operatingCashBreakEvenMonth === null && netOperatingCashFlow.gte(0)) {
      operatingCashBreakEvenMonth = month;
    }

    if (cumulativeCashBreakEvenMonth === null && bankCashBalance.gte(0)) {
      cumulativeCashBreakEvenMonth = month;
    }
    if (
      cumulativeCashBreakEvenMonth === null &&
      launch.openingBankCashAfterLaunch.gte(0)
    ) {
      cumulativeCashBreakEvenMonth = 0;
    }

    monthly.push({
      month,
      occupancyPct: occupancy.times(100),
      cashInflows,
      cashOutflows,
      netOperatingCashFlow,
      capexOutflows,
      financingInflows: fundingInflows,
      financingOutflows,
      netCashFlow,
      bankCashBalance,
      cumulativeCash: bankCashBalance,
      recoveryPosition,
      investmentRemaining: recoveryPosition,
      cumulativeFreeCashFlow: recoveryPosition,
      cumulativeOperatingCashGenerated,
      bankCashMovements,
    });
  }

  const investmentRecoveredMonth =
    monthly.find((m) => m.recoveryPosition.gte(0))?.month ?? null;

  const cashHealth = buildCashHealthSummary(
    monthly,
    initialInvestment,
    investmentRecoveredMonth,
    launch.openingBankCashAfterLaunch,
    launch.founderEquity,
    launch.loanAmount
  );

  return {
    monthly,
    lowestCashPoint: cashHealth.lowestBankCash,
    lowestCashMonth: cashHealth.lowestBankCashMonth,
    operatingCashBreakEvenMonth: cashHealth.operatingCashPositiveMonth,
    cumulativeCashBreakEvenMonth: cashHealth.bankCashPositiveMonth,
    initialInvestment,
    launch,
    cashHealth,
    inflowBasis: OPERATING_CASH_INFLOW_BASIS.id,
    traces: {
      endingCash: trace(
        "Ending bank cash",
        "After launch: opening funded cash + operating − loan. Working capital retained, not spent.",
        "INR",
        monthly.length > 0
          ? [
              {
                label: `Month ${monthly.length} bank balance`,
                expression: monthly[monthly.length - 1].bankCashBalance.toString(),
                result: monthly[monthly.length - 1].bankCashBalance,
              },
            ]
          : [],
        monthly.length > 0
          ? monthly[monthly.length - 1].bankCashBalance
          : launch.openingBankCashAfterLaunch
      ),
    },
  };
}
