import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { d, WEEKS_PER_MONTH } from "../decimal";
import { stripGst, calculateWeightedRealisedRevenue } from "../engine/revenue";
import { calculateCapacity } from "../engine/capacity";
import { runFinanceModel } from "../index";
import { createSampleAssumptions } from "../sample-data";
import { calculatePL } from "../engine/pl";
import { calculateDirectCosts, calculateOperatingExpenses } from "../engine/costs";
import { calculateRevenue } from "../engine/revenue";
import { totalStandingSpotCommittedSeatsMonthly } from "../engine/standing-spots";

describe("GST handling", () => {
  it("strips GST from inclusive price correctly", () => {
    const result = stripGst(d(2000), 18, "inclusive");
    expect(result.net.toFixed(2)).toBe("1694.92");
    expect(result.gst.plus(result.net).toFixed(2)).toBe("2000.00");
  });

  it("handles exclusive price entry", () => {
    const result = stripGst(d(1700), 18, "exclusive");
    expect(result.net.toFixed(2)).toBe("1700.00");
    expect(result.gross.toFixed(2)).toBe("2006.00");
  });
});

describe("Capacity calculations", () => {
  const assumptions = createSampleAssumptions();

  it("calculates weekly seats: 3 × 5 × 6 = 90", () => {
    const capacity = calculateCapacity(assumptions);
    expect(capacity.weeklyAvailableSeats.toNumber()).toBe(90);
  });

  it("calculates monthly seats: 90 × 52/12 = 390", () => {
    const capacity = calculateCapacity(assumptions);
    expect(capacity.monthlyAvailableSeats.toFixed(0)).toBe("390");
  });

  it("uses 52/12 not hardcoded 4 weeks", () => {
    expect(WEEKS_PER_MONTH.toNumber()).toBeCloseTo(4.333333, 5);
  });

  it("calculates occupied seats at 60% = 234", () => {
    const capacity = calculateCapacity(assumptions);
    expect(capacity.occupiedSeatsMonthly.toFixed(0)).toBe("234");
  });
});

describe("Weighted realised revenue", () => {
  it("validates package mix totals 100%", () => {
    const assumptions = createSampleAssumptions();
    const weighted = calculateWeightedRealisedRevenue(assumptions);
    expect(weighted.mixValid).toBe(true);
    expect(weighted.mixTotal.toNumber()).toBe(100);
  });
});

describe("Revenue at fixture values", () => {
  it("allocates group revenue via service booking mix", () => {
    const assumptions = createSampleAssumptions();
    const capacity = calculateCapacity(assumptions);
    const revenue = calculateRevenue(assumptions, capacity.occupiedSeatsMonthly);

    const groupNet = revenue.weightedRevenue.weightedGroupNetSalesPerOccupiedSpot;
    const blendedNet = revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot;
    expect(groupNet.gt(1200)).toBe(true);
    expect(blendedNet.gt(groupNet)).toBe(true);
    expect(revenue.weightedRevenue.mixTotal.toNumber()).toBeCloseTo(100, 1);

    expect(revenue.sessionAllocation.flexibleCreditSessions.gt(0)).toBe(true);
    expect(revenue.groupClassRevenue.gt(0)).toBe(true);
    expect(revenue.privateRevenue.gt(0)).toBe(true);
    expect(revenue.netRevenue.gt(revenue.groupClassRevenue)).toBe(true);
  });
});

describe("P&L invariants", () => {
  it("gross profit = net revenue - direct costs", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const { pl, revenue, directCosts } = model;
    expect(pl.grossProfit.toFixed(2)).toBe(
      revenue.netRevenue.minus(directCosts.totalDirectCosts).toFixed(2)
    );
  });

  it("EBITDA = gross profit - operating expenses", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.pl.ebitda.toFixed(2)).toBe(
      model.pl.grossProfit.minus(model.operatingExpenses.totalOperatingExpenses).toFixed(2)
    );
  });

  it("EBIT = EBITDA - depreciation", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.pl.ebit.toFixed(2)).toBe(
      model.pl.ebitda.minus(model.pl.depreciation).toFixed(2)
    );
  });

  it("Net profit = PBT - tax", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.pl.netProfit.toFixed(2)).toBe(
      model.pl.profitBeforeTax.minus(model.pl.incomeTax).toFixed(2)
    );
  });
});

describe("Occupancy constraints", () => {
  it("occupied seats cannot exceed available seats at 100%", () => {
    const assumptions = { ...createSampleAssumptions(), projectedBookedOccupancyPct: 100 };
    const capacity = calculateCapacity(assumptions);
    expect(capacity.occupiedSeatsMonthly.lte(capacity.monthlyAvailableSeats)).toBe(true);
  });
});

describe("Full model run", () => {
  it("runs without validation errors on sample data", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.validationErrors).toHaveLength(0);
    expect(model.summary.reformers).toBe(3);
    expect(model.summary.weeklyClasses.toNumber()).toBe(30);
  });

  it("GST is not counted as revenue", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.revenue.netRevenue.lt(model.revenue.grossCustomerBillings)).toBe(true);
  });

  it("capex is separate from operating expenses", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.capex.nonRecoverableCapex.gt(0)).toBe(true);
    expect(model.operatingExpenses.totalOperatingExpenses.lt(model.capex.nonRecoverableCapex)).toBe(true);
  });
});

describe("Decimal precision", () => {
  it("uses Decimal.js for precise money arithmetic", () => {
    const a = d("0.1");
    const b = d("0.2");
    expect(a.plus(b).toString()).toBe("0.3");
    // Native JS floating point fails this
    expect(0.1 + 0.2).not.toBe(0.3);
  });
});
