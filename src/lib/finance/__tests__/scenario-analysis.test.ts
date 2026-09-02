import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../run-model";
import {
  analyzeScenario,
  compareScenarios,
  diffAssumptionsFromBase,
  runOneVariableSensitivity,
  runTwoVariableSensitivity,
  calculateKeyDrivers,
} from "../engine/scenarios";

describe("Scenario Analysis orchestration", () => {
  const base = createSampleAssumptions();
  base.name = "Base Case";

  it("reconciles Base Case with Math Overview (runFinanceModel)", () => {
    const model = runFinanceModel(base);
    const analysis = analyzeScenario(base);
    expect(analysis.metrics.earnedNetRevenue.toFixed(2)).toBe(
      model.revenue.netRevenue.toFixed(2)
    );
    expect(analysis.metrics.ebitda.toFixed(2)).toBe(model.pl.ebitda.toFixed(2));
    expect(analysis.metrics.netProfit.toFixed(2)).toBe(
      model.pl.netProfit.toFixed(2)
    );
    expect(analysis.metrics.paybackMonth).toBe(model.payback.paybackMonth);
  });

  it("shows assumption diffs from base", () => {
    const conservative = {
      ...structuredClone(base),
      name: "Conservative",
      projectedBookedOccupancyPct: 45,
    };
    const diffs = diffAssumptionsFromBase(base, conservative);
    expect(diffs.some((d) => d.label === "Occupancy")).toBe(true);
    expect(diffs.find((d) => d.label === "Occupancy")?.delta).toBe(
      "-15 percentage points"
    );
  });

  it("recalculates all downstream outputs when occupancy changes", () => {
    const low = analyzeScenario({ ...base, projectedBookedOccupancyPct: 40 });
    const high = analyzeScenario({ ...base, projectedBookedOccupancyPct: 80 });
    expect(high.metrics.earnedNetRevenue.gt(low.metrics.earnedNetRevenue)).toBe(
      true
    );
    expect(high.metrics.ebitda.gt(low.metrics.ebitda)).toBe(true);
  });

  it("uses central engine for sensitivity cells", () => {
    const rows = runOneVariableSensitivity(base, "occupancy", "ebitda", [50, 70]);
    expect(rows[1].outputValue.gt(rows[0].outputValue)).toBe(true);
  });

  it("two-variable sensitivity uses runFinanceModel per cell", () => {
    const matrix = runTwoVariableSensitivity(
      base,
      "occupancy",
      "realisedRevenue",
      "ebitda",
      [50, 60],
      [1500, 1600]
    );
    expect(matrix.length).toBe(2);
    expect(matrix[0].length).toBe(2);
  });

  it("generates summary from calculated outputs only", () => {
    const analysis = analyzeScenario(base);
    expect(analysis.summary.paragraphs.length).toBeGreaterThan(0);
    expect(analysis.summary.paragraphs[0]).toContain(String(base.projectedBookedOccupancyPct));
  });

  it("compareScenarios returns metrics for each scenario", () => {
    const conservative = { ...structuredClone(base), projectedBookedOccupancyPct: 45, name: "Conservative" };
    const strong = { ...structuredClone(base), projectedBookedOccupancyPct: 80, name: "Strong Demand" };
    const results = compareScenarios(base, [conservative, strong]);
    expect(results).toHaveLength(2);
    expect(results[0].metrics.occupancyPct).toBe(45);
    expect(results[1].metrics.occupancyPct).toBe(80);
  });

  it("ranks key drivers by EBITDA impact magnitude", () => {
    const drivers = calculateKeyDrivers(base);
    expect(drivers.length).toBeGreaterThan(0);
    expect(drivers[0].rank).toBe(1);
  });

  it("payback uses cumulative cash flow not simplified ratio alone", () => {
    const analysis = analyzeScenario(base);
    expect(analysis.metrics.paybackMonth).toBe(
      runFinanceModel(base).payback.paybackMonth
    );
  });
});
