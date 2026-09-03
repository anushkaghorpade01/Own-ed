import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../run-model";
import {
  evaluateSalesPlan,
  getMonthForecastProfit,
  runSalesTargetAnalysis,
} from "../engine/sales-client-target";

function clone() {
  return structuredClone(createSampleAssumptions());
}

describe("Month X forecast profit (Sales & Client Target)", () => {
  it("uses monthlyProjection[7].pl.netProfit for Month 8", () => {
    const assumptions = clone();
    const model = runFinanceModel(assumptions);
    const analysis = runSalesTargetAnalysis(assumptions, { targetMonth: 8 });

    expect(getMonthForecastProfit(assumptions, 8).toNumber()).toBe(
      model.monthlyProjection[7]!.pl.netProfit.toNumber()
    );
    expect(analysis.forecastProfit.toNumber()).toBe(
      model.monthlyProjection[7]!.pl.netProfit.toNumber()
    );
  });

  it("uses monthlyProjection[11].pl.netProfit for Month 12", () => {
    const assumptions = clone();
    const model = runFinanceModel(assumptions);
    const analysis = runSalesTargetAnalysis(assumptions, { targetMonth: 12 });

    expect(analysis.forecastProfit.toNumber()).toBe(
      model.monthlyProjection[11]!.pl.netProfit.toNumber()
    );
  });

  it("changes Month 8 forecast when month-affecting assumptions change", () => {
    const base = clone();
    const before = getMonthForecastProfit(base, 8);
    const after = getMonthForecastProfit({ ...base, rent: base.rent + 100_000 }, 8);
    expect(after.lt(before)).toBe(true);
  });

  it("does not change Month 8 forecast when only sales plan quantities change", () => {
    const assumptions = clone();
    const analysis = runSalesTargetAnalysis(assumptions, { targetMonth: 8 });
    const products = analysis.suggestedMix.quantities.map((q) => q.productId);
    const zeroPlan = Object.fromEntries(products.map((id) => [id, 0]));
    const heavyPlan = Object.fromEntries(products.map((id) => [id, 50]));

    evaluateSalesPlan(assumptions, zeroPlan, 8, 200_000);
    evaluateSalesPlan(assumptions, heavyPlan, 8, 200_000);

    const again = runSalesTargetAnalysis(assumptions, { targetMonth: 8 });
    expect(again.forecastProfit.toNumber()).toBe(analysis.forecastProfit.toNumber());
  });

  it("changes sales plan profit when manual quantities change", () => {
    const assumptions = clone();
    const products = runSalesTargetAnalysis(assumptions).suggestedMix.quantities;
    const zero = Object.fromEntries(products.map((q) => [q.productId, 0]));
    const withSales = Object.fromEntries(
      products.map((q) => [q.productId, Math.max(q.quantity, 10)])
    );

    const zeroSol = evaluateSalesPlan(assumptions, zero, 8, 200_000);
    const salesSol = evaluateSalesPlan(assumptions, withSales, 8, 200_000);
    expect(salesSol.planningNetProfit.gt(zeroSol.planningNetProfit)).toBe(true);
  });

  it("steady-state P&L uses target booked occupancy, not ramp month", () => {
    const assumptions = {
      ...clone(),
      rampPackSalesMode: "steady" as const,
    };
    const model = runFinanceModel(assumptions);
    const month8 = getMonthForecastProfit(assumptions, 8);

    expect(model.pl.netProfit.gte(month8)).toBe(true);
    expect(model.pl.netProfit.toNumber()).not.toBe(month8.toNumber());
  });

  it("gap to target equals target minus Month X forecast", () => {
    const analysis = runSalesTargetAnalysis(clone(), {
      targetMonthlyNetProfit: 200_000,
      targetMonth: 8,
    });
    expect(analysis.profitGap.toNumber()).toBe(
      Math.max(0, 200_000 - analysis.forecastProfit.toNumber())
    );
    expect(analysis.profitSurplus.toNumber()).toBe(
      Math.max(0, analysis.forecastProfit.toNumber() - 200_000)
    );
  });

  it("shows surplus when forecast exceeds target", () => {
    const assumptions = clone();
    const forecast = getMonthForecastProfit(assumptions, 8).toNumber();
    const analysis = runSalesTargetAnalysis(assumptions, {
      targetMonthlyNetProfit: Math.max(0, Math.floor(forecast - 10_000)),
      targetMonth: 8,
    });

    expect(analysis.profitSurplus.gt(0)).toBe(true);
    expect(analysis.profitGap.toNumber()).toBe(0);
  });

  it("planning net profit includes depreciation", () => {
    const assumptions = clone();
    const snapshot = runFinanceModel(assumptions).monthlyProjection[7]!;
    expect(snapshot.pl.depreciation.gt(0)).toBe(true);
    expect(snapshot.pl.netProfit.lt(snapshot.pl.ebitda)).toBe(true);
  });
});
