/**
 * Investment recovery vs bank cash — reconciliation helpers.
 */
import { d, sum } from "../decimal";
import type Decimal from "decimal.js";
import type { FinanceAssumptions, FundingEvent } from "../schemas";
import type { CapexResult } from "./costs";
import type { MonthlyCashFlow } from "./cash-flow";
import {
  formatRecoveryPosition,
  recoveryPositionFromParts,
} from "./recovery-position";

export interface LaunchCashBreakdown {
  nonRecoverableCapex: Decimal;
  recoverableDeposits: Decimal;
  workingCapital: Decimal;
  /** Capex + deposit paid out at launch (WC retained in bank) */
  cashPaidOutAtLaunch: Decimal;
  /** Total liquidity needed = cash paid out + WC buffer */
  totalCashRequiredAtLaunch: Decimal;
  /** Payback hurdle = non-recoverable capex + WC (+ deposit if toggled) */
  paybackInvestmentBase: Decimal;
  founderEquity: Decimal;
  loanAmount: Decimal;
  additionalFundingTotal: Decimal;
  totalFunding: Decimal;
  /** Cash required minus funding injected at launch */
  launchFundingGap: Decimal;
  /** Bank cash after launch payments, before month 1 operating */
  openingBankCashAfterLaunch: Decimal;
  includeRecoverableDepositInPayback: boolean;
  capexBreakdown: Array<{ name: string; amount: Decimal; recoverable: boolean }>;
}

export interface MonthReconciliation {
  month: number;
  recoveryPosition: Decimal;
  cumulativeOperatingCashGenerated: Decimal;
  monthOperatingCash: Decimal;
  bankCashBalance: Decimal;
  /** @deprecated use recoveryPosition */
  investmentRemaining: Decimal;
  bankCashMovements?: MonthlyCashFlow["bankCashMovements"];
}

export interface CashHealthSummary {
  lowestBankCash: Decimal;
  lowestBankCashMonth: number;
  /** All planned funding: founder + loan + scheduled injections */
  totalPlannedFunding: Decimal;
  /** max(0, −lowestBankCash) — additional funding beyond current plan */
  fundingGap: Decimal;
  /** totalPlannedFunding + fundingGap */
  minimumTotalFundingRequired: Decimal;
  /** Cushion at lowest point when bank stays positive */
  fundingSurplus: Decimal;
  /** @deprecated use fundingGap */
  minimumAdditionalFundingRequired: Decimal;
  bankCashPositiveMonth: number | null;
  operatingCashPositiveMonth: number | null;
  investmentRecoveredMonth: number | null;
  endingBankCash: Decimal;
  month36RecoveryPosition: Decimal;
  month36CumulativeOperatingCash: Decimal;
}

/** Launch funding at month 1 (legacy fields) plus any events scheduled for that month. */
export function getFundingInflowsForMonth(
  assumptions: FinanceAssumptions,
  month: number
): Decimal {
  let total = d(0);
  if (month === 1) {
    total = total.plus(assumptions.founderEquity).plus(assumptions.loanAmount);
  }
  for (const event of assumptions.additionalFundingEvents ?? []) {
    if (event.month === month) {
      total = total.plus(event.amount);
    }
  }
  return total;
}

export function sumAdditionalFunding(assumptions: FinanceAssumptions): Decimal {
  return sum((assumptions.additionalFundingEvents ?? []).map((e) => d(e.amount)));
}

export function buildLaunchCashBreakdown(
  assumptions: FinanceAssumptions,
  capex: CapexResult
): LaunchCashBreakdown {
  const nonRecoverableCapex = capex.nonRecoverableCapex;
  const recoverableDeposits = capex.recoverableDeposits;
  const workingCapital = d(assumptions.workingCapital);
  const founderEquity = d(assumptions.founderEquity);
  const loanAmount = d(assumptions.loanAmount);
  const additionalFundingTotal = sumAdditionalFunding(assumptions);
  const cashPaidOutAtLaunch = nonRecoverableCapex.plus(recoverableDeposits);
  const totalCashRequiredAtLaunch = cashPaidOutAtLaunch.plus(workingCapital);
  const paybackInvestmentBase = assumptions.includeRecoverableDepositInPayback
    ? nonRecoverableCapex.plus(workingCapital).plus(recoverableDeposits)
    : nonRecoverableCapex.plus(workingCapital);
  const launchFunding = founderEquity.plus(loanAmount).plus(
    sum(
      (assumptions.additionalFundingEvents ?? [])
        .filter((e) => e.month === 0)
        .map((e) => d(e.amount))
    )
  );
  const totalFunding = founderEquity.plus(loanAmount).plus(additionalFundingTotal);
  const openingBankCashAfterLaunch = launchFunding.minus(cashPaidOutAtLaunch);

  return {
    nonRecoverableCapex,
    recoverableDeposits,
    workingCapital,
    cashPaidOutAtLaunch,
    totalCashRequiredAtLaunch,
    paybackInvestmentBase,
    founderEquity,
    loanAmount,
    additionalFundingTotal,
    totalFunding,
    launchFundingGap: totalCashRequiredAtLaunch.minus(launchFunding),
    openingBankCashAfterLaunch,
    includeRecoverableDepositInPayback: assumptions.includeRecoverableDepositInPayback,
    capexBreakdown: capex.breakdown,
  };
}

export function buildInvestmentRecoverySeries(
  monthly: MonthlyCashFlow[],
  paybackInvestmentBase: Decimal
): MonthReconciliation[] {
  const month0: MonthReconciliation = {
    month: 0,
    recoveryPosition: paybackInvestmentBase.negated(),
    cumulativeOperatingCashGenerated: d(0),
    monthOperatingCash: d(0),
    bankCashBalance: d(0),
    investmentRemaining: paybackInvestmentBase.negated(),
  };

  const rows = monthly.map((m) => ({
    month: m.month,
    recoveryPosition: m.recoveryPosition,
    cumulativeOperatingCashGenerated: m.cumulativeOperatingCashGenerated,
    monthOperatingCash: m.netOperatingCashFlow,
    bankCashBalance: m.bankCashBalance,
    investmentRemaining: m.recoveryPosition,
    bankCashMovements: m.bankCashMovements,
  }));

  return [month0, ...rows];
}

export function buildBankCashSeries(
  monthly: MonthlyCashFlow[],
  openingBankCashAfterLaunch: Decimal
): Array<{ month: number; bankCashBalance: Decimal }> {
  return [
    { month: 0, bankCashBalance: openingBankCashAfterLaunch },
    ...monthly.map((m) => ({
      month: m.month,
      bankCashBalance: m.bankCashBalance,
    })),
  ];
}

export function buildCashHealthSummary(
  monthly: MonthlyCashFlow[],
  paybackInvestmentBase: Decimal,
  investmentRecoveredMonth: number | null,
  openingBankCashAfterLaunch: Decimal,
  totalPlannedFunding: Decimal
): CashHealthSummary {
  const lowest = monthly.reduce(
    (acc, m) => {
      const candidates = [
        { balance: openingBankCashAfterLaunch, month: 0 },
        { balance: m.bankCashBalance, month: m.month },
      ];
      for (const c of candidates) {
        if (c.balance.lt(acc.lowestBankCash)) {
          acc.lowestBankCash = c.balance;
          acc.lowestBankCashMonth = c.month;
        }
      }
      return acc;
    },
    { lowestBankCash: openingBankCashAfterLaunch, lowestBankCashMonth: 0 }
  );

  const last = monthly[monthly.length - 1];
  const month36 = monthly.find((m) => m.month === 36) ?? last;
  const fundingGap = lowest.lowestBankCash.lt(0) ? lowest.lowestBankCash.abs() : d(0);
  const fundingSurplus = lowest.lowestBankCash.gt(0) ? lowest.lowestBankCash : d(0);
  const minimumTotalFundingRequired = totalPlannedFunding.plus(fundingGap);

  return {
    lowestBankCash: lowest.lowestBankCash,
    lowestBankCashMonth: lowest.lowestBankCashMonth,
    totalPlannedFunding,
    fundingGap,
    minimumTotalFundingRequired,
    fundingSurplus,
    minimumAdditionalFundingRequired: fundingGap,
    bankCashPositiveMonth:
      monthly.find((m) => m.bankCashBalance.gte(0))?.month ??
      (openingBankCashAfterLaunch.gte(0) ? 0 : null),
    operatingCashPositiveMonth: monthly.find((m) => m.netOperatingCashFlow.gte(0))?.month ?? null,
    investmentRecoveredMonth,
    endingBankCash: last?.bankCashBalance ?? openingBankCashAfterLaunch,
    month36RecoveryPosition:
      month36?.recoveryPosition ??
      recoveryPositionFromParts(d(0), paybackInvestmentBase),
    month36CumulativeOperatingCash:
      month36?.cumulativeOperatingCashGenerated ?? d(0),
  };
}

export { formatRecoveryPosition, recoveryPositionFromParts };

export function newFundingEvent(partial?: Partial<FundingEvent>): FundingEvent {
  return {
    id: `funding-${Date.now()}`,
    type: partial?.type ?? "founder_equity",
    amount: partial?.amount ?? 0,
    month: partial?.month ?? 6,
    note: partial?.note,
  };
}

/** Deterministic sanity: ₹10L recover, ₹1L/mo operating, ₹10L founder, ₹8L launch spend → ₹2L opening bank */
export function simpleSanityScenario() {
  return {
    founderFunding: 1_000_000,
    paybackBase: 1_000_000,
    launchSpend: 800_000,
    openingBank: 200_000,
    monthlyOperating: 100_000,
  };
}

export function simplePaybackScenario(): {
  investmentBase: number;
  monthlyCash: number;
  months: number;
  expectedRecoveryByMonth: number[];
} {
  const investmentBase = 1_000_000;
  const monthlyCash = 100_000;
  const months = 12;
  const expectedRecoveryByMonth: number[] = [0];
  for (let m = 1; m <= months; m++) {
    expectedRecoveryByMonth.push(-investmentBase + monthlyCash * m);
  }
  return { investmentBase, monthlyCash, months, expectedRecoveryByMonth };
}

export function sumOperatingThroughMonth(
  monthly: MonthlyCashFlow[],
  month: number
): Decimal {
  return sum(
    monthly.filter((m) => m.month <= month).map((m) => m.netOperatingCashFlow)
  );
}
