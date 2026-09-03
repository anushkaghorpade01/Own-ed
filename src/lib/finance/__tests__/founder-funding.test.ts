import { describe, it, expect } from "vitest";
import { d } from "../decimal";
import { runFinanceModel } from "../run-model";
import { createSampleAssumptions } from "../sample-data";
import {
  buildCashHealthSummary,
  buildLaunchCashBreakdown,
} from "../engine/investment-recovery";
import { calculateCapex } from "../engine/costs";
import type { MonthlyCashFlow } from "../engine/cash-flow";
import { defaultAppState } from "@/lib/store/default-state";
import {
  appStateToPayload,
  payloadToAppState,
} from "@/lib/data/local/persistence-service";

function clone() {
  return structuredClone(createSampleAssumptions());
}

describe("Founder funding canonical state", () => {
  it("uses lowest bank cash point for funding gap — not sum of monthly deficits", () => {
    const opening = d(-500_000);
    const monthly: MonthlyCashFlow[] = [
      {
        month: 1,
        occupancyPct: d(0),
        cashInflows: d(0),
        cashOutflows: d(0),
        netOperatingCashFlow: d(-200_000),
        capexOutflows: d(0),
        financingInflows: d(0),
        financingOutflows: d(0),
        netCashFlow: d(-200_000),
        bankCashBalance: d(-700_000),
        cumulativeCash: d(-700_000),
        recoveryPosition: d(0),
        investmentRemaining: d(0),
        cumulativeFreeCashFlow: d(0),
        cumulativeOperatingCashGenerated: d(-200_000),
      },
      {
        month: 2,
        occupancyPct: d(0),
        cashInflows: d(0),
        cashOutflows: d(0),
        netOperatingCashFlow: d(100_000),
        capexOutflows: d(0),
        financingInflows: d(0),
        financingOutflows: d(0),
        netCashFlow: d(100_000),
        bankCashBalance: d(-600_000),
        cumulativeCash: d(-600_000),
        recoveryPosition: d(0),
        investmentRemaining: d(0),
        cumulativeFreeCashFlow: d(0),
        cumulativeOperatingCashGenerated: d(-100_000),
      },
    ];

    const health = buildCashHealthSummary(monthly, d(1_000_000), null, opening, d(1_500_000));

    expect(health.lowestBankCash.toNumber()).toBe(-700_000);
    expect(health.lowestBankCashMonth).toBe(1);
    expect(health.fundingGap.toNumber()).toBe(700_000);
    expect(health.minimumTotalFundingRequired.toNumber()).toBe(2_200_000);
    expect(health.fundingGap.toNumber()).not.toBe(1_800_000);
  });

  it("keeps founder funding planned separate from minimum total required", () => {
    const base = clone();
    base.founderEquity = 2_500_000;
    base.loanAmount = 1_000_000;
    const model = runFinanceModel(base);
    const health = model.cashFlow.cashHealth;
    const launch = model.cashFlow.launch;

    expect(launch.founderEquity.toNumber()).toBe(2_500_000);
    expect(health.totalPlannedFunding.toNumber()).toBe(3_500_000);
    expect(health.minimumTotalFundingRequired.toNumber()).toBe(
      health.totalPlannedFunding.plus(health.fundingGap).toNumber()
    );
    if (health.fundingGap.gt(0)) {
      expect(launch.founderEquity.toNumber()).not.toBe(
        health.minimumTotalFundingRequired.toNumber()
      );
    }
  });

  it("lowest bank cash shifts by exactly delta when founder funding changes", () => {
    const base = clone();
    const at325 = runFinanceModel(base);
    const at250 = runFinanceModel({ ...base, founderEquity: 2_500_000 });

    expect(
      at325.cashFlow.launch.openingBankCashAfterLaunch
        .minus(at250.cashFlow.launch.openingBankCashAfterLaunch)
        .toNumber()
    ).toBe(750_000);
    expect(
      at325.cashFlow.cashHealth.lowestBankCash
        .minus(at250.cashFlow.cashHealth.lowestBankCash)
        .toNumber()
    ).toBe(750_000);
    expect(at250.revenue.netRevenue.toFixed(2)).toBe(at325.revenue.netRevenue.toFixed(2));
    expect(at250.pl.ebitda.toFixed(2)).toBe(at325.pl.ebitda.toFixed(2));
    expect(at250.payback.initialInvestment.toNumber()).toBe(
      at325.payback.initialInvestment.toNumber()
    );
  });
});

describe("Launch cash reconciliation", () => {
  it("explains ₹28.35L vs ₹25.35L as security deposit when excluded from payback", () => {
    const a = clone();
    a.includeRecoverableDepositInPayback = false;
    const capex = calculateCapex(a);
    const launch = buildLaunchCashBreakdown(a, capex);

    expect(launch.paybackInvestmentBase.toNumber()).toBe(2_535_000);
    expect(launch.totalCashRequiredAtLaunch.toNumber()).toBe(2_835_000);
    expect(
      launch.totalCashRequiredAtLaunch.minus(launch.paybackInvestmentBase).toNumber()
    ).toBe(a.securityDepositAmount);
  });

  it("counts working capital once in launch investment and cash required", () => {
    const model = runFinanceModel(clone());
    const launch = model.cashFlow.launch;
    expect(launch.paybackInvestmentBase.minus(launch.nonRecoverableCapex).toNumber()).toBe(
      model.assumptions.workingCapital
    );
    expect(
      launch.totalCashRequiredAtLaunch
        .minus(launch.nonRecoverableCapex)
        .minus(launch.recoverableDeposits)
        .minus(launch.workingCapital)
        .toNumber()
    ).toBe(0);
    if ((model.assumptions.preOpeningMonths ?? 0) === 0) {
      expect(launch.cashPaidOutAtLaunch.toNumber()).toBe(
        launch.nonRecoverableCapex.plus(launch.recoverableDeposits).toNumber()
      );
    } else {
      expect(launch.cashPaidOutAtLaunch.lt(launch.nonRecoverableCapex)).toBe(true);
    }
  });
});

describe("Founder funding persistence", () => {
  it("persists founder funding across reload payload round-trip", () => {
    const state = defaultAppState();
    state.assumptions.founderEquity = 2_500_000;
    const payload = appStateToPayload(state);
    const restored = payloadToAppState(payload);
    expect(restored.assumptions.founderEquity).toBe(2_500_000);
  });
});

describe("Minimum funding deterministic scenario", () => {
  it("launch ₹20L outflow, ₹15L founder → ₹7L gap at month 1 trough", () => {
    const opening = d(1_500_000 - 2_000_000);
    expect(opening.toNumber()).toBe(-500_000);

    const monthly: MonthlyCashFlow[] = [
      {
        month: 1,
        occupancyPct: d(0),
        cashInflows: d(0),
        cashOutflows: d(0),
        netOperatingCashFlow: d(-200_000),
        capexOutflows: d(0),
        financingInflows: d(0),
        financingOutflows: d(0),
        netCashFlow: d(-200_000),
        bankCashBalance: d(-700_000),
        cumulativeCash: d(-700_000),
        recoveryPosition: d(0),
        investmentRemaining: d(0),
        cumulativeFreeCashFlow: d(0),
        cumulativeOperatingCashGenerated: d(-200_000),
      },
      {
        month: 2,
        occupancyPct: d(0),
        cashInflows: d(0),
        cashOutflows: d(0),
        netOperatingCashFlow: d(100_000),
        capexOutflows: d(0),
        financingInflows: d(0),
        financingOutflows: d(0),
        netCashFlow: d(100_000),
        bankCashBalance: d(-600_000),
        cumulativeCash: d(-600_000),
        recoveryPosition: d(0),
        investmentRemaining: d(0),
        cumulativeFreeCashFlow: d(0),
        cumulativeOperatingCashGenerated: d(-100_000),
      },
    ];

    const planned = d(1_500_000);
    const health = buildCashHealthSummary(monthly, d(2_000_000), null, opening, planned);

    expect(health.fundingGap.toNumber()).toBe(700_000);
    expect(health.minimumTotalFundingRequired.toNumber()).toBe(2_200_000);
  });
});
