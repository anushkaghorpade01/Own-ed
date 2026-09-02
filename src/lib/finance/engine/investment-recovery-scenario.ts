import type { FinanceModelOutput } from "../run-model";

/** Local-only inputs for the investment recovery chart — not persisted to assumptions. */
export interface InvestmentRecoveryScenarioInputs {
  nonRecoverableCapex: number;
  workingCapital: number;
  securityDepositAmount: number;
  includeRecoverableDepositInPayback: boolean;
  projectedBookedOccupancyPct: number;
  rampUpStartingOccupancyPct: number;
  rampUpMonthsToTarget: number;
}

export function extractInvestmentRecoveryScenarioDefaults(
  model: FinanceModelOutput
): InvestmentRecoveryScenarioInputs {
  const launch = model.cashFlow.launch;
  const a = model.assumptions;
  return {
    nonRecoverableCapex: launch.nonRecoverableCapex.toNumber(),
    workingCapital: launch.workingCapital.toNumber(),
    securityDepositAmount: launch.recoverableDeposits.toNumber(),
    includeRecoverableDepositInPayback: launch.includeRecoverableDepositInPayback,
    projectedBookedOccupancyPct: a.projectedBookedOccupancyPct,
    rampUpStartingOccupancyPct: a.rampUpStartingOccupancyPct,
    rampUpMonthsToTarget: a.rampUpMonthsToTarget,
  };
}

export function computePaybackInvestmentBase(
  inputs: Pick<
    InvestmentRecoveryScenarioInputs,
    | "nonRecoverableCapex"
    | "workingCapital"
    | "securityDepositAmount"
    | "includeRecoverableDepositInPayback"
  >
): number {
  const base = inputs.nonRecoverableCapex + inputs.workingCapital;
  return inputs.includeRecoverableDepositInPayback
    ? base + inputs.securityDepositAmount
    : base;
}

export function scenariosEqual(
  a: InvestmentRecoveryScenarioInputs,
  b: InvestmentRecoveryScenarioInputs
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface RecoveryChartPoint {
  month: number;
  recoveryPosition: number;
  monthOperatingCash: number;
  cumulativeOperatingCashGenerated: number;
  initialInvestment: number;
}

export function buildRecoveryChartFromOperatingCash(
  monthlyOperatingCash: number[],
  paybackInvestmentBase: number
): RecoveryChartPoint[] {
  const rows: RecoveryChartPoint[] = [
    {
      month: 0,
      recoveryPosition: -paybackInvestmentBase,
      monthOperatingCash: 0,
      cumulativeOperatingCashGenerated: 0,
      initialInvestment: paybackInvestmentBase,
    },
  ];

  let cumulative = 0;
  for (let i = 0; i < monthlyOperatingCash.length; i++) {
    const monthOperatingCash = monthlyOperatingCash[i] ?? 0;
    cumulative += monthOperatingCash;
    rows.push({
      month: i + 1,
      recoveryPosition: cumulative - paybackInvestmentBase,
      monthOperatingCash,
      cumulativeOperatingCashGenerated: cumulative,
      initialInvestment: paybackInvestmentBase,
    });
  }

  return rows;
}

export function estimatePaybackMonth(chartData: RecoveryChartPoint[]): {
  paybackMonth: number | null;
  paybackMonthEstimate: number | null;
  paybackNotReached: boolean;
} {
  let paybackMonth: number | null = null;
  let paybackMonthEstimate: number | null = null;

  for (let i = 1; i < chartData.length; i++) {
    const point = chartData[i]!;
    const prior = chartData[i - 1]!;
    if (point.recoveryPosition >= 0) {
      paybackMonth = point.month;
      if (prior.recoveryPosition < 0 && point.recoveryPosition !== prior.recoveryPosition) {
        const gap = point.recoveryPosition - prior.recoveryPosition;
        paybackMonthEstimate = Math.round((prior.month + point.recoveryPosition / gap) * 10) / 10;
      } else {
        paybackMonthEstimate = point.month;
      }
      break;
    }
  }

  return {
    paybackMonth,
    paybackMonthEstimate,
    paybackNotReached: paybackMonth === null,
  };
}
