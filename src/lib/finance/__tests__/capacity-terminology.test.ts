import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../index";
import { calculateCreditLiability, calculateUnusedCapacityAnalysis } from "../engine/unit-economics";
import { calculateCapacity } from "../engine/capacity";
import { calculateWeightedRealisedRevenue } from "../engine/revenue";
import { totalStandingSpotCommittedSeatsMonthly } from "../engine/standing-spots";

describe("Unused capacity — not a financial loss", () => {
  it("calculates unused capacity as physical minus occupied", () => {
    const assumptions = createSampleAssumptions();
    const capacity = calculateCapacity(assumptions);
    const weighted = calculateWeightedRealisedRevenue(assumptions);
    const analysis = calculateUnusedCapacityAnalysis(
      assumptions,
      capacity.monthlyAvailableSeats,
      capacity.occupiedSeatsMonthly,
      weighted.weightedNetRevenuePerCredit
    );

    expect(analysis.totalPhysicalCapacity.toFixed(0)).toBe("390");
    expect(analysis.expectedOccupiedCapacity.toFixed(0)).toBe("234");
    expect(analysis.unusedCapacity.toFixed(0)).toBe("156");
  });

  it("does not include unused capacity in earned revenue", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.revenue.groupClassRevenue.gt(0)).toBe(true);
    expect(model.revenue.sessionAllocation.mixValid).toBe(true);
    expect(model.revenue.productLevel.length).toBeGreaterThan(0);
  });

  it("unrealised opportunity is theoretical and separate from P&L", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.unusedCapacity.unrealisedRevenueOpportunity.gt(0)).toBe(true);
    expect(model.pl.netRevenue.lt(model.unusedCapacity.unrealisedRevenueOpportunity.plus(model.revenue.netRevenue))).toBe(true);
  });
});

describe("Credit liability — proper capacity distinctions", () => {
  it("uses uncommitted capacity not total physical for eligible coverage", () => {
    const assumptions = createSampleAssumptions();
    const capacity = calculateCapacity(assumptions);
    const cl = calculateCreditLiability(
      assumptions,
      capacity.monthlyAvailableSeats,
      capacity.occupiedSeatsMonthly,
      50
    );

    expect(cl.uncommittedRemainingCapacity.toFixed(0)).toBe("156");
    expect(cl.eligibleCapacityForCredits.toFixed(0)).toBe("156");
    expect(cl.naiveTotalCapacityCoverageRatio.gt(cl.eligibleCoverageRatio)).toBe(true);
  });

  it("detects slot constraint when total looks sufficient but peak does not", () => {
    const assumptions = {
      ...createSampleAssumptions(),
      creditsExpectedRedemptionBeforeExpiry: 200,
      peakOccupancyPct: 95,
      peakSlotsShareOfCapacityPct: 30,
    };
    const capacity = calculateCapacity(assumptions);
    const cl = calculateCreditLiability(
      assumptions,
      capacity.monthlyAvailableSeats,
      capacity.occupiedSeatsMonthly,
      30
    );

    expect(cl.naiveTotalCapacityCoverageRatio.gte(1)).toBe(true);
    expect(cl.slotConstraintDetected || cl.peakCoverageRatio.lt(1)).toBe(true);
  });

  it("tracks breakage separately", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.creditLiability.creditsExpectedToExpireUnused.toFixed(0)).toBe("18");
  });
});
