"use client";

import { useMemo } from "react";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { formatINR } from "@/lib/format/currency";
import { Explainer } from "@/components/ui/explainer";
import { formatRecoveryPositionInr } from "@/components/finance/cash-flow-chart-tooltips";
import {
  buildInvestmentRecoverySeries,
} from "@/lib/finance/engine/investment-recovery";

export function CashFlowCalculationExplainer({ month = 1 }: { month?: number }) {
  const model = useFinanceModel();
  const launch = model.cashFlow.launch;
  const health = model.cashFlow.cashHealth;
  const m = model.cashFlow.monthly.find((row) => row.month === month) ?? model.cashFlow.monthly[0];
  const series = useMemo(
    () => buildInvestmentRecoverySeries(model.cashFlow.monthly, launch.paybackInvestmentBase),
    [model.cashFlow.monthly, launch.paybackInvestmentBase]
  );
  const monthRow = series.find((row) => row.month === month) ?? series[1];

  if (!m || !monthRow) return null;

  const movements = m.bankCashMovements;
  const recovery = formatRecoveryPositionInr(monthRow.recoveryPosition.toNumber());

  return (
    <Explainer
      trigger="How is this calculated?"
      sections={[
        {
          title: "Investment recovery",
          content: [
            `Initial investment to recover: ${formatINR(launch.paybackInvestmentBase)}`,
            `= non-recoverable capex ${formatINR(launch.nonRecoverableCapex)}`,
            `+ working capital ${formatINR(launch.workingCapital)}`,
            launch.includeRecoverableDepositInPayback
              ? `+ security deposit ${formatINR(launch.recoverableDeposits)} (in payback hurdle)`
              : `— deposit ${formatINR(launch.recoverableDeposits)} excluded from hurdle`,
            "",
            `Cumulative operating cash generated (through month ${month}): ${formatINR(m.cumulativeOperatingCashGenerated)}`,
            `Recovery position: ${recovery.label} ${formatINR(recovery.amount)}`,
            "",
            `${formatINR(m.cumulativeOperatingCashGenerated)} − ${formatINR(launch.paybackInvestmentBase)} = ${formatINR(monthRow.recoveryPosition)}`,
          ].join("\n"),
        },
        {
          title: "Bank cash (month 1 bridge)",
          content: movements
            ? [
                `Opening after launch (month 0): ${formatINR(launch.openingBankCashAfterLaunch)}`,
                `= founder equity ${formatINR(movements.founderEquity)}`,
                `+ loan ${formatINR(movements.loanProceeds)}`,
                movements.additionalFunding.gt(0)
                  ? `+ additional funding ${formatINR(movements.additionalFunding)}`
                  : null,
                `− capex ${formatINR(movements.capexPaid)}`,
                `− deposit ${formatINR(movements.depositPaid)}`,
                "",
                `Month ${month} operating collections: ${formatINR(movements.operatingInflows)}`,
                `Month ${month} operating payments: ${formatINR(movements.operatingOutflows)}`,
                `Net operating: ${formatINR(m.netOperatingCashFlow)}`,
                `− loan repayments: ${formatINR(movements.loanRepayments)}`,
                `= Ending bank cash: ${formatINR(m.bankCashBalance)}`,
                "",
                "Working capital is funding retained in the bank — not subtracted as an outflow.",
                health.minimumAdditionalFundingRequired.gt(0)
                  ? `Funding gap: ${formatINR(health.minimumAdditionalFundingRequired)} additional liquidity needed at lowest point.`
                  : "No funding gap under current plan.",
              ]
                .filter(Boolean)
                .join("\n")
            : `Prior bank balance + operating cash − loan = ${formatINR(m.bankCashBalance)}`,
        },
        {
          title: "What funding does not affect",
          content:
            "Founder equity, loans, and additional funding change bank cash only. They do not change revenue, EBITDA, operating profit, or investment recovery performance.",
        },
      ]}
    />
  );
}
