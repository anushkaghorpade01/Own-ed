import { describe, it, expect } from "vitest";
import { d } from "../decimal";
import { runFinanceModel } from "../run-model";
import { createSampleAssumptions } from "../sample-data";
import { calculateCapex } from "../engine/costs";
import {
  buildInvestmentRecoverySeries,
  buildLaunchCashBreakdown,
  simplePaybackScenario,
} from "../engine/investment-recovery";
import { calculatePayback } from "../engine/break-even";
import { recoveryPositionFromParts } from "../engine/recovery-position";

function clone() {
  return structuredClone(createSampleAssumptions());
}

describe("Investment recovery vs bank cash", () => {
  it("reconciles payback base to capex line items exactly", () => {
    const a = createSampleAssumptions();
    const capex = calculateCapex(a);
    const launch = buildLaunchCashBreakdown(a, capex);
    const sumNonRec = capex.breakdown
      .filter((i) => !i.recoverable)
      .reduce((s, i) => s + i.amount.toNumber(), 0);

    expect(launch.nonRecoverableCapex.toNumber()).toBe(sumNonRec);
    expect(launch.nonRecoverableCapex.toNumber()).toBe(2_335_000);
    expect(launch.paybackInvestmentBase.toNumber()).toBe(2_335_000 + a.workingCapital);
    expect(launch.paybackInvestmentBase.toNumber()).toBe(2_535_000);
  });

  it("reconciles month 1 bank cash line by line", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const launch = model.cashFlow.launch;
    const m1 = model.cashFlow.monthly[0]!;
    const movements = m1.bankCashMovements!;

    expect(launch.openingBankCashAfterLaunch.toFixed(2)).toBe(
      movements.founderEquity
        .plus(movements.loanProceeds)
        .plus(movements.additionalFunding)
        .minus(movements.capexPaid)
        .minus(movements.depositPaid)
        .toFixed(2)
    );

    expect(m1.bankCashBalance.toFixed(2)).toBe(
      launch.openingBankCashAfterLaunch.plus(m1.netOperatingCashFlow).minus(movements.loanRepayments).toFixed(2)
    );

    expect(movements.depositPaid.toNumber()).toBe(model.assumptions.securityDepositAmount);
  });

  it("recovery position = cumulative operating − payback base", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const m1 = model.cashFlow.monthly[0]!;
    const expected = recoveryPositionFromParts(
      m1.cumulativeOperatingCashGenerated,
      model.cashFlow.launch.paybackInvestmentBase
    );
    expect(m1.recoveryPosition.toFixed(2)).toBe(expected.toFixed(2));
  });

  it("month 0 recovery position equals negative payback base", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const series = buildInvestmentRecoverySeries(
      model.cashFlow.monthly,
      model.cashFlow.launch.paybackInvestmentBase
    );
    expect(series[0]!.recoveryPosition.toNumber()).toBe(-2_535_000);
    expect(series[0]!.cumulativeOperatingCashGenerated.toNumber()).toBe(0);
  });

  it("month 36 recovery equals cumulative generated minus base", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const m36 = model.cashFlow.monthly.find((m) => m.month === 36)!;
    expect(m36.recoveryPosition.toFixed(2)).toBe(
      m36.cumulativeOperatingCashGenerated
        .minus(model.payback.initialInvestment)
        .toFixed(2)
    );
  });

  it("computes minimum additional funding from lowest bank cash", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const health = model.cashFlow.cashHealth;
    if (health.lowestBankCash.lt(0)) {
      expect(health.minimumAdditionalFundingRequired.toFixed(2)).toBe(
        health.lowestBankCash.abs().toFixed(2)
      );
    } else {
      expect(health.minimumAdditionalFundingRequired.toNumber()).toBe(0);
    }
  });
});

describe("Founder funding does not affect operating performance", () => {
  it("increasing founder equity improves bank cash but not recovery or revenue", () => {
    const base = runFinanceModel(clone());
    const after = runFinanceModel({ ...clone(), founderEquity: clone().founderEquity + 500_000 });

    expect(after.cashFlow.launch.openingBankCashAfterLaunch.minus(
      base.cashFlow.launch.openingBankCashAfterLaunch
    ).toNumber()).toBe(500_000);
    expect(after.cashFlow.cashHealth.minimumAdditionalFundingRequired.lte(
      base.cashFlow.cashHealth.minimumAdditionalFundingRequired
    )).toBe(true);
    expect(after.revenue.netRevenue.toFixed(2)).toBe(base.revenue.netRevenue.toFixed(2));
    expect(after.pl.ebitda.toFixed(2)).toBe(base.pl.ebitda.toFixed(2));
    expect(after.cashFlow.monthly[0]!.recoveryPosition.toFixed(2)).toBe(
      base.cashFlow.monthly[0]!.recoveryPosition.toFixed(2)
    );
  });
});

describe("Interiors capex", () => {
  it("increases payback base and lowers bank cash without changing operating revenue", () => {
    const base = runFinanceModel(clone());
    const after = runFinanceModel({
      ...clone(),
      capexInteriorFitout: clone().capexInteriorFitout + 500_000,
    });

    expect(after.payback.initialInvestment.minus(base.payback.initialInvestment).toNumber()).toBe(
      500_000
    );
    expect(after.cashFlow.launch.openingBankCashAfterLaunch.lt(
      base.cashFlow.launch.openingBankCashAfterLaunch
    )).toBe(true);
    expect(after.revenue.netRevenue.toFixed(2)).toBe(base.revenue.netRevenue.toFixed(2));
  });
});

describe("Security deposit", () => {
  it("always reduces bank cash at launch", () => {
    const a = clone();
    a.includeRecoverableDepositInPayback = true;
    const model = runFinanceModel(a);
    expect(model.cashFlow.monthly[0]!.bankCashMovements!.depositPaid.toNumber()).toBe(
      a.securityDepositAmount
    );
  });

  it("in payback hurdle only when toggled — never double counted", () => {
    const excluded = runFinanceModel({ ...clone(), includeRecoverableDepositInPayback: false });
    const included = runFinanceModel({ ...clone(), includeRecoverableDepositInPayback: true });
    expect(included.payback.initialInvestment.minus(excluded.payback.initialInvestment).toNumber()).toBe(
      clone().securityDepositAmount
    );
    expect(included.pl.ebitda.toFixed(2)).toBe(excluded.pl.ebitda.toFixed(2));
  });
});

describe("Simple payback scenario", () => {
  it("recovers ₹10L at ₹1L/month in month 10", () => {
    const { investmentBase, expectedRecoveryByMonth } = simplePaybackScenario();
    const series = expectedRecoveryByMonth.map((cumulative, month) => ({
      month,
      cumulative: d(cumulative),
    }));
    const payback = calculatePayback(d(investmentBase), d(0), d(0), false, series);
    expect(payback.paybackMonth).toBe(10);
    expect(series[10]!.cumulative.toNumber()).toBe(0);
    expect(series[11]!.cumulative.toNumber()).toBe(100_000);
  });
});

describe("Deposit when included in payback base", () => {
  it("still pays deposit from bank at launch", () => {
    const a = clone();
    a.includeRecoverableDepositInPayback = true;
    const model = runFinanceModel(a);
    expect(model.cashFlow.monthly[0]!.bankCashMovements!.depositPaid.toNumber()).toBe(
      a.securityDepositAmount
    );
    expect(model.payback.initialInvestment.toNumber()).toBe(2_835_000);
  });
});

describe("Dynamic propagation", () => {
  it("occupancy increase improves recovery without changing payback base", () => {
    const base = runFinanceModel(clone());
    const after = runFinanceModel({
      ...clone(),
      projectedBookedOccupancyPct: clone().projectedBookedOccupancyPct + 10,
      rampUpTargetOccupancyPct: clone().rampUpTargetOccupancyPct + 10,
    });
    expect(after.payback.initialInvestment.toNumber()).toBe(base.payback.initialInvestment.toNumber());
    expect(
      after.cashFlow.monthly[11]!.recoveryPosition.gt(base.cashFlow.monthly[11]!.recoveryPosition)
    ).toBe(true);
  });

  it("private price increase improves recovery and payback timing", () => {
    const base = runFinanceModel(clone());
    const after = runFinanceModel({
      ...clone(),
      products: clone().products.map((p) =>
        p.type === "private" ? { ...p, price: 5000 } : p
      ),
      privatePrice: 5000,
    });
    expect(
      after.cashFlow.monthly[12]!.recoveryPosition.gt(base.cashFlow.monthly[12]!.recoveryPosition)
    ).toBe(true);
  });
});
