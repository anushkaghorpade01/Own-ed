/**
 * Month-by-month bank cash bridge from launch through the lowest cash point.
 */
import { d } from "../decimal";
import type Decimal from "decimal.js";
import type { FinanceAssumptions } from "../schemas";
import type { LaunchCashBreakdown } from "./investment-recovery";
import { getFundingInflowsForMonth } from "./investment-recovery";
import type { MonthlyCashFlow } from "./cash-flow";

export interface FundingBridgeMonth {
  month: number;
  openingBankCash: Decimal;
  founderFunding: Decimal;
  loanFunding: Decimal;
  otherInjections: Decimal;
  customerCollections: Decimal;
  launchCapex: Decimal;
  securityDeposit: Decimal;
  operatingOutflows: Decimal;
  loanPayments: Decimal;
  netOperatingCashFlow: Decimal;
  closingBankCash: Decimal;
}

export function buildFundingBridgeToLowPoint(
  assumptions: FinanceAssumptions,
  monthly: MonthlyCashFlow[],
  launch: LaunchCashBreakdown,
  lowestBankCashMonth: number
): FundingBridgeMonth[] {
  const rows: FundingBridgeMonth[] = [];
  const endMonth = Math.max(0, lowestBankCashMonth);

  rows.push({
    month: 0,
    openingBankCash: d(0),
    founderFunding: launch.founderEquity,
    loanFunding: launch.loanAmount,
    otherInjections: d(0),
    customerCollections: d(0),
    launchCapex: launch.nonRecoverableCapex,
    securityDeposit: launch.recoverableDeposits,
    operatingOutflows: d(0),
    loanPayments: d(0),
    netOperatingCashFlow: d(0),
    closingBankCash: launch.openingBankCashAfterLaunch,
  });

  for (let month = 1; month <= endMonth; month++) {
    const m = monthly.find((row) => row.month === month);
    if (!m) continue;

    const movements = m.bankCashMovements;
    const priorClosing = rows[rows.length - 1]!.closingBankCash;
    const monthFunding = getFundingInflowsForMonth(assumptions, month);
    const founderFunding = month === 1 ? launch.founderEquity : d(0);
    const loanFunding = month === 1 ? launch.loanAmount : d(0);
    const otherInjections = monthFunding.minus(founderFunding).minus(loanFunding);

    rows.push({
      month,
      openingBankCash: movements?.openingBankBeforeMonth ?? priorClosing,
      founderFunding: movements?.founderEquity ?? founderFunding,
      loanFunding: movements?.loanProceeds ?? loanFunding,
      otherInjections: movements?.additionalFunding ?? otherInjections,
      customerCollections: movements?.operatingInflows ?? m.cashInflows,
      launchCapex: month === 1 ? (movements?.capexPaid ?? launch.nonRecoverableCapex) : d(0),
      securityDeposit: month === 1 ? (movements?.depositPaid ?? launch.recoverableDeposits) : d(0),
      operatingOutflows: movements?.operatingOutflows ?? m.cashOutflows,
      loanPayments: movements?.loanRepayments ?? m.financingOutflows,
      netOperatingCashFlow: m.netOperatingCashFlow,
      closingBankCash: m.bankCashBalance,
    });
  }

  return rows;
}

/** Format bridge rows as explainer lines for UI */
export function formatFundingBridgeExplainer(
  bridge: FundingBridgeMonth[],
  launch: LaunchCashBreakdown,
  fundingGap: Decimal,
  lowestBankCash: Decimal,
  lowestMonth: number
): string[] {
  const lines: string[] = [
    "Bank cash bridge from launch through the lowest point:",
    "",
  ];

  for (const row of bridge) {
    if (row.month === 0) {
      lines.push("Month 0 — after launch payments");
      lines.push(`  + Founder funding ${row.founderFunding.toFixed(0)}`);
      if (row.loanFunding.gt(0)) lines.push(`  + Loan ${row.loanFunding.toFixed(0)}`);
      lines.push(`  − Launch capex ${row.launchCapex.toFixed(0)}`);
      lines.push(`  − Security deposit ${row.securityDeposit.toFixed(0)}`);
      lines.push(`  = Opening bank cash ${row.closingBankCash.toFixed(0)}`);
      lines.push(
        `  (Working capital ${launch.workingCapital.toFixed(0)} retained in bank — not spent)`
      );
      lines.push("");
      continue;
    }

    lines.push(`Month ${row.month}`);
    lines.push(`  Opening ${row.openingBankCash.toFixed(0)}`);
    if (row.otherInjections.gt(0)) {
      lines.push(`  + Other injections ${row.otherInjections.toFixed(0)}`);
    }
    lines.push(`  + Customer collections ${row.customerCollections.toFixed(0)}`);
    lines.push(`  − Operating payments ${row.operatingOutflows.toFixed(0)}`);
    lines.push(`  = Net operating ${row.netOperatingCashFlow.toFixed(0)}`);
    if (row.loanPayments.gt(0)) {
      lines.push(`  − Loan payments ${row.loanPayments.toFixed(0)}`);
    }
    lines.push(`  = Ending bank cash ${row.closingBankCash.toFixed(0)}`);
    lines.push("");
  }

  lines.push(`Lowest bank cash: ${lowestBankCash.toFixed(0)} at month ${lowestMonth}`);
  if (fundingGap.gt(0)) {
    lines.push(
      `Funding gap = max(0, −lowest) = ${fundingGap.toFixed(0)} additional funding required`
    );
    lines.push("(Uses the most negative point — monthly deficits are not summed.)");
  } else {
    lines.push("No funding gap — bank cash stays at or above zero.");
  }

  return lines;
}

export function formatLaunchCashExplainer(launch: LaunchCashBreakdown): string[] {
  const depositInPayback = launch.includeRecoverableDepositInPayback;
  const launchInvestmentDiff = launch.totalCashRequiredAtLaunch.minus(
    launch.paybackInvestmentBase
  );

  const lines = [
    `Launch investment (payback hurdle): ${launch.paybackInvestmentBase.toFixed(0)}`,
    `  = Non-recoverable capex ${launch.nonRecoverableCapex.toFixed(0)}`,
    `  + Working capital ${launch.workingCapital.toFixed(0)}`,
  ];

  if (depositInPayback) {
    lines.push(
      `  + Security deposit ${launch.recoverableDeposits.toFixed(0)} (included in hurdle)`
    );
  }

  lines.push("");
  lines.push(`Cash required at launch: ${launch.totalCashRequiredAtLaunch.toFixed(0)}`);
  lines.push(`  = Cash paid out at launch ${launch.cashPaidOutAtLaunch.toFixed(0)}`);
  lines.push(
    `    (capex ${launch.nonRecoverableCapex.toFixed(0)} + deposit ${launch.recoverableDeposits.toFixed(0)})`
  );
  lines.push(
    `  + Working capital buffer ${launch.workingCapital.toFixed(0)} (funded, retained in bank)`
  );

  if (!depositInPayback && launchInvestmentDiff.gt(0)) {
    lines.push("");
    lines.push(
      `Difference vs payback hurdle: ${launchInvestmentDiff.toFixed(0)} = security deposit paid at launch (excluded from payback unless toggled)`
    );
  }

  return lines;
}
