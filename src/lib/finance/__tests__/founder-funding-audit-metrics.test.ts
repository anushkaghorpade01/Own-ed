import { describe, it, expect } from "vitest";
import { runFinanceModel } from "../run-model";
import { createSampleAssumptions } from "../sample-data";

/** Snapshot metrics for audit report — sample assumptions at ₹25L founder funding */
describe("founder funding audit metrics", () => {
  it("reports reconciliation numbers at ₹25L", () => {
    const model = runFinanceModel({
      ...createSampleAssumptions(),
      founderEquity: 2_500_000,
      loanAmount: 0,
    });
    const launch = model.cashFlow.launch;
    const health = model.cashFlow.cashHealth;

    expect(launch.totalCashRequiredAtLaunch.toNumber()).toBe(2_835_000);
    expect(launch.openingBankCashAfterLaunch.toNumber()).toBe(-135_000);
    expect(health.lowestBankCash.toNumber()).toBeLessThan(0);
    expect(health.fundingGap.toNumber()).toBe(183_268.02708409092);
    expect(health.minimumTotalFundingRequired.toNumber()).toBe(2_683_268.0270840907);
    expect(health.totalPlannedFunding.toNumber()).toBe(2_500_000);
  });
});
