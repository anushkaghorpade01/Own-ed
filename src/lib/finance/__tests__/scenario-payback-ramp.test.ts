import { describe, it, expect } from "vitest";
import { createSampleAssumptions, createSampleScenarios } from "../sample-data";
import { runFinanceModel } from "../run-model";

describe("Scenario payback — ramp target follows booked occupancy", () => {
  it("Strong Demand payback differs from base when occupancy differs", () => {
    const base = createSampleAssumptions();
    const scenarios = createSampleScenarios(base);
    const baseCase = scenarios.find((s) => s.id === "scenario-base")!;
    const strong = scenarios.find((s) => s.id === "scenario-strong-demand")!;

    expect(strong.assumptions.projectedBookedOccupancyPct).toBe(80);
    expect(baseCase.assumptions.projectedBookedOccupancyPct).toBe(60);

    const baseModel = runFinanceModel(baseCase.assumptions);
    const strongModel = runFinanceModel(strong.assumptions);

    expect(strongModel.pl.ebitda.gt(baseModel.pl.ebitda)).toBe(true);
    expect(strongModel.payback.paybackMonth).toBe(22);

    const baseRecoveryM36 = baseModel.cashFlow.monthly[35]!.recoveryPosition;
    const strongRecoveryM36 = strongModel.cashFlow.monthly[35]!.recoveryPosition;
    expect(strongRecoveryM36.gt(baseRecoveryM36)).toBe(true);

    if (baseModel.payback.paybackMonth !== null) {
      expect(strongModel.payback.paybackMonth!).toBeLessThan(baseModel.payback.paybackMonth!);
    }
  });

  it("changing projectedBookedOccupancyPct alone changes cumulative recovery", () => {
    const base = createSampleAssumptions();
    const low = runFinanceModel({ ...base, projectedBookedOccupancyPct: 45 });
    const high = runFinanceModel({ ...base, projectedBookedOccupancyPct: 80 });

    expect(high.payback.paybackMonth).not.toBeNull();
    expect(
      high.cashFlow.monthly[35]!.recoveryPosition.gt(
        low.cashFlow.monthly[35]!.recoveryPosition
      )
    ).toBe(true);

    if (low.payback.paybackMonth !== null && high.payback.paybackMonth !== null) {
      expect(high.payback.paybackMonth!).toBeLessThan(low.payback.paybackMonth!);
    }
  });
});
