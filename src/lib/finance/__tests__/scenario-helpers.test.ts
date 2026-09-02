import { describe, it, expect } from "vitest";
import { createSampleAssumptions, createSampleScenarios } from "../sample-data";
import {
  resolveBaseAssumptionsForAnalysis,
  resolveScenarioAssumptionsForAnalysis,
} from "../scenario-helpers";

describe("scenario base case resolution", () => {
  it("uses live saved assumptions for Base Case analysis", () => {
    const live = createSampleAssumptions();
    live.projectedBookedOccupancyPct = 72;
    live.name = "Saved assumptions";

    const [baseScenario] = createSampleScenarios(createSampleAssumptions());
    baseScenario.assumptions.projectedBookedOccupancyPct = 60;

    const resolved = resolveBaseAssumptionsForAnalysis(live, baseScenario);
    expect(resolved.projectedBookedOccupancyPct).toBe(72);
    expect(resolved.name).toBe(baseScenario.name);
  });

  it("resolves Base Case scenario from live assumptions, not its stored copy", () => {
    const live = createSampleAssumptions();
    live.projectedBookedOccupancyPct = 68;

    const [baseScenario] = createSampleScenarios(createSampleAssumptions());
    baseScenario.isBaseCase = true;
    baseScenario.assumptions.projectedBookedOccupancyPct = 60;

    const resolved = resolveScenarioAssumptionsForAnalysis(baseScenario, live);
    expect(resolved.projectedBookedOccupancyPct).toBe(68);
  });

  it("keeps non-base scenario assumptions unchanged", () => {
    const live = createSampleAssumptions();
    live.projectedBookedOccupancyPct = 72;

    const scenarios = createSampleScenarios(createSampleAssumptions());
    const conservative = scenarios.find((s) => s.id === "scenario-conservative")!;
    conservative.assumptions.projectedBookedOccupancyPct = 45;

    const resolved = resolveScenarioAssumptionsForAnalysis(conservative, live);
    expect(resolved.projectedBookedOccupancyPct).toBe(45);
  });
});
