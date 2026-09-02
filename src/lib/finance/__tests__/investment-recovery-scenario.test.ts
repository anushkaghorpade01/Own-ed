import { describe, expect, it } from "vitest";
import {
  buildRecoveryChartFromOperatingCash,
  computePaybackInvestmentBase,
  estimatePaybackMonth,
} from "../engine/investment-recovery-scenario";

describe("investment recovery scenario helpers", () => {
  it("computes payback investment base with optional deposit", () => {
    expect(
      computePaybackInvestmentBase({
        nonRecoverableCapex: 2_000_000,
        workingCapital: 500_000,
        securityDepositAmount: 300_000,
        includeRecoverableDepositInPayback: false,
      })
    ).toBe(2_500_000);

    expect(
      computePaybackInvestmentBase({
        nonRecoverableCapex: 2_000_000,
        workingCapital: 500_000,
        securityDepositAmount: 300_000,
        includeRecoverableDepositInPayback: true,
      })
    ).toBe(2_800_000);
  });

  it("builds recovery chart and estimates payback month", () => {
    const chart = buildRecoveryChartFromOperatingCash(
      Array.from({ length: 12 }, () => 100_000),
      1_000_000
    );

    expect(chart[0]?.recoveryPosition).toBe(-1_000_000);
    expect(chart[10]?.recoveryPosition).toBe(0);
    const payback = estimatePaybackMonth(chart);
    expect(payback.paybackMonth).toBe(10);
    expect(payback.paybackNotReached).toBe(false);
  });
});
