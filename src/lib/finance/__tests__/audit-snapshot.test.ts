import { describe, it, expect } from "vitest";
import { runFinanceModel } from "../run-model";
import { createSampleAssumptions } from "../sample-data";

describe("audit snapshot", () => {
  it("sample assumptions reconciliation", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const launch = model.cashFlow.launch;
    const health = model.cashFlow.cashHealth;

    expect(launch.paybackInvestmentBase.toNumber()).toBe(2_535_000);
    expect(launch.totalCashRequiredAtLaunch.toNumber()).toBe(2_835_000);
    expect(launch.founderEquity.toNumber()).toBe(3_250_000);
    expect(health.fundingGap.toNumber()).toBe(0);
    expect(health.minimumTotalFundingRequired.toNumber()).toBe(3_250_000);
    expect(health.minimumAdditionalFundingRequired.toNumber()).toBe(0);
  });
});
