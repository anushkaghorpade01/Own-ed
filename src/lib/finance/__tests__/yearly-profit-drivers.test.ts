import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { runMonthlyProjection } from "../engine/monthly-projection";
import { aggregateYearlyPL } from "../engine/yearly-pl";
import { analyzeYearlyProfitDrivers } from "../engine/yearly-profit-drivers";
import { createDefaultCostEscalations } from "../engine/escalation";

describe("yearly profit driver explanations", () => {
  it("Year 1 explains occupancy ramp baseline", () => {
    const monthly = runMonthlyProjection(createSampleAssumptions(), 36);
    const yearly = aggregateYearlyPL(monthly, 3);
    const explanations = analyzeYearlyProfitDrivers(monthly, yearly.years);

    expect(explanations[0].direction).toBe("baseline");
    expect(explanations[0].summary).toMatch(/occupancy ramp/i);
  });

  it("Year 3 down with flat sales cites cost escalation", () => {
    const base = createSampleAssumptions();
    const assumptions = {
      ...base,
      rampUpMonthsToTarget: 12,
      rampUpStartingOccupancyPct: 30,
      rampUpTargetOccupancyPct: 70,
      forecastSettings: {
        forecastYears: 3,
        costEscalationPreset: "base" as const,
        costEscalations: createDefaultCostEscalations(),
        productPriceGrowth: [],
        forecastTimeline: [],
      },
    };

    const monthly = runMonthlyProjection(assumptions, 36);
    const yearly = aggregateYearlyPL(monthly, 3);
    const explanations = analyzeYearlyProfitDrivers(monthly, yearly.years);

    const year3 = explanations[2];
    expect(yearly.years[2].yoyNetRevenuePct?.abs().lt(1)).toBe(true);

    if (year3.direction === "down") {
      expect(year3.summary).toMatch(/lower|cost|escalat|flat/i);
      expect(year3.topDrivers.some((d) => d.impact.lt(0))).toBe(true);
    }
  });

  it("higher price growth produces explanation mentioning sales", () => {
    const base = createSampleAssumptions();
    const pack8 = base.products.find((p) => p.name.includes("8"))!;
    const withGrowth = {
      ...base,
      forecastSettings: {
        forecastYears: 3,
        costEscalationPreset: "custom" as const,
        costEscalations: createDefaultCostEscalations().map((r) => ({
          ...r,
          annualPct: 2,
        })),
        productPriceGrowth: [
          { productId: pack8.id, annualIncreasePct: 8, firstIncreaseMonth: 13 },
        ],
        forecastTimeline: [],
      },
    };

    const monthly = runMonthlyProjection(withGrowth, 36);
    const yearly = aggregateYearlyPL(monthly, 3);
    const explanations = analyzeYearlyProfitDrivers(monthly, yearly.years);

    const year2 = explanations[1];
    if (year2.direction === "up") {
      expect(year2.summary).toMatch(/sales|Net sales|pricing|occupancy/i);
    }
  });

  it("yearExplanations included in aggregateYearlyPL", () => {
    const model = aggregateYearlyPL(runMonthlyProjection(createSampleAssumptions(), 36), 3);
    expect(model.yearExplanations).toHaveLength(3);
    expect(model.forecastHealth[0].note).toBe(model.yearExplanations[0].summary);
  });

  it("4th reformer from month 13 appears in Year 2 profit explanation", () => {
    const base = createSampleAssumptions();
    const assumptions = {
      ...base,
      forecastSettings: {
        forecastYears: 3,
        costEscalationPreset: "custom" as const,
        costEscalations: createDefaultCostEscalations(),
        productPriceGrowth: [],
        forecastTimeline: [
          {
            id: "phase-4th",
            label: "Add 4th reformer",
            startMonth: 13,
            endMonth: 36,
            assumptionOverrides: { reformers: 4 },
          },
        ],
      },
    };

    const monthly = runMonthlyProjection(assumptions, 36);
    expect(monthly[12].structural.reformers).toBe(4);
    expect(monthly[0].structural.reformers).toBe(3);

    const yearly = aggregateYearlyPL(monthly, 3);
    const year2Explanation = yearly.yearExplanations[1];

    expect(year2Explanation.structuralNotes.some((n) => /reformer/i.test(n))).toBe(true);
    expect(year2Explanation.summary).toMatch(/reformer|Structural/i);
    expect(yearly.years[1].netRevenue.gt(yearly.years[0].netRevenue)).toBe(true);
  });
});
