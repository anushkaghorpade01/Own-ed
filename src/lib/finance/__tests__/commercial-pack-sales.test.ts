import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import {
  calculateCommercialPackSales,
  resolveRampPackSalesMultiplier,
} from "../engine/commercial-pack-sales";
import { calculateCreditLiability } from "../engine/unit-economics";
import { runFinanceModel } from "../run-model";
import { getFirstOperatingMonth } from "../engine/pre-opening";

describe("commercial pack sales", () => {
  it("uses expectedSalesVolumePerMonth at target occupancy", () => {
    const a = createSampleAssumptions();
    expect(resolveRampPackSalesMultiplier(a, 60).toNumber()).toBe(1);
    const sales = calculateCommercialPackSales(a, 60);
    expect(sales.totalNetRevenue.toNumber()).toBeGreaterThan(0);
    expect(sales.rows.some((r) => r.productId === "8-pack" && r.packsSold.toNumber() === 8)).toBe(
      true
    );
  });

  it("boosts pack volume below target when aggressive pre-sale", () => {
    const a = createSampleAssumptions();
    const sales = calculateCommercialPackSales(a, 30);
    expect(sales.multiplier.toNumber()).toBe(2);
    expect(sales.rows.find((r) => r.productId === "8-pack")!.packsSold.toNumber()).toBeGreaterThan(
      sales.rows.find((r) => r.productId === "8-pack")!.basePacksSold.toNumber()
    );
  });

  it("adds commercial pack revenue to P&L separate from drop-in mix", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.revenue.commercialPackRevenue.gt(0)).toBe(true);
    expect(model.revenue.commercialPackRevenue.toFixed(0)).toBe(
      model.revenue.commercialPackSales.totalNetRevenue.toFixed(0)
    );
  });

  it("raises month-3 profit vs occupancy-only when pre-selling packs", () => {
    const a = createSampleAssumptions();
    const model = runFinanceModel(a);
    const firstOp = getFirstOperatingMonth(a);
    const month3 = model.monthlyProjection[firstOp - 1]!;
    expect(month3.revenue.commercialPackRevenue.gt(0)).toBe(true);
    expect(month3.revenue.commercialPackSales.multiplier.gt(1)).toBe(true);
  });

  it("warns when pre-sale credits exceed uncommitted capacity", () => {
    const a = createSampleAssumptions();
    const sales = calculateCommercialPackSales(a, 15);
    const model = runFinanceModel(a);
    const cl = calculateCreditLiability(
      a,
      model.capacity.monthlyAvailableSeats,
      model.capacity.monthlyAvailableSeats.times(0.15),
      a.peakSlotsShareOfCapacityPct,
      sales
    );
    expect(cl.aggressivePresaleActive).toBe(true);
    expect(cl.presaleWarning).toBeTruthy();
  });
});
