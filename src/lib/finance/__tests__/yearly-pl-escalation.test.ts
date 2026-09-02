import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../run-model";
import { runMonthlyProjection } from "../engine/monthly-projection";
import { aggregateYearlyPL, verifyYearlyReconciliation } from "../engine/yearly-pl";
import {
  applyMonthAssumptions,
  resolveForecastSettings,
  createDefaultCostEscalations,
} from "../engine/escalation";
import { d } from "../decimal";

describe("yearly P&L and escalation", () => {
  it("yearly totals reconcile to monthly sums", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const check = verifyYearlyReconciliation(model.monthlyProjection, model.yearlyPL);
    expect(check.ok, check.errors.join("; ")).toBe(true);
  });

  it("Year 1 net profit equals sum of months 1–12", () => {
    const monthly = runMonthlyProjection(createSampleAssumptions(), 36);
    const yearly = aggregateYearlyPL(monthly, 3);
    const year1 = yearly.years[0];

    const sumNetProfit = monthly
      .filter((m) => m.month >= 1 && m.month <= 12)
      .reduce((acc, m) => acc.plus(m.pl.netProfit), d(0));

    expect(year1.netProfit.toNumber()).toBeCloseTo(sumNetProfit.toNumber(), 2);
  });

  it("payroll escalation 9% → 15% increases Year 2 payroll from month 13", () => {
    const base = createSampleAssumptions();
    const rules = createDefaultCostEscalations().map((r) =>
      r.categoryId === "payroll" ? { ...r, annualPct: 15, ruleBasis: "custom" as const } : r
    );
    const assumptions = {
      ...base,
      forecastSettings: {
        forecastYears: 3,
        costEscalationPreset: "custom" as const,
        costEscalations: rules,
        productPriceGrowth: [],
        forecastTimeline: [],
      },
    };

    const monthly = runMonthlyProjection(assumptions, 36);
    const month12 = monthly[11];
    const month13 = monthly[12];

    expect(month12.operatingExpenses.ownerSalary.toNumber()).toBeCloseTo(
      month13.operatingExpenses.ownerSalary.dividedBy(1.15).toNumber(),
      0
    );

    const yearly = aggregateYearlyPL(monthly, 3);
    expect(yearly.years[1].payroll.gt(yearly.years[0].payroll)).toBe(true);
  });

  it("rent 15% every 36 months — no change until month 37", () => {
    const base = createSampleAssumptions();
    const rules = createDefaultCostEscalations().map((r) =>
      r.categoryId === "rent"
        ? {
            ...r,
            escalationType: "step_pct_interval" as const,
            stepPct: 15,
            stepIntervalMonths: 36,
            firstEscalationMonth: 37,
            contractActive: true,
            ruleBasis: "contract" as const,
          }
        : r
    );
    const assumptions = {
      ...base,
      rent: 100_000,
      forecastSettings: {
        forecastYears: 4,
        costEscalationPreset: "custom" as const,
        costEscalations: rules,
        productPriceGrowth: [],
        forecastTimeline: [],
      },
    };

    const m36 = applyMonthAssumptions(assumptions, 36);
    const m37 = applyMonthAssumptions(assumptions, 37);

    expect(m36.rent).toBe(100_000);
    expect(m37.rent).toBeCloseTo(115_000, 0);
  });

  it("payment gateway pct is not inflated — cost rises with sales only", () => {
    const base = createSampleAssumptions();
    const m12 = applyMonthAssumptions(base, 12);
    const m24 = applyMonthAssumptions(base, 24);

    expect(m12.paymentGatewayPct).toBe(m24.paymentGatewayPct);
    expect(m12.paymentGatewayPct).toBe(2);
  });

  it("product price growth increases future net sales", () => {
    const base = createSampleAssumptions();
    const pack8 = base.products.find((p) => p.name.includes("8"))!;
    const withGrowth = {
      ...base,
      forecastSettings: {
        forecastYears: 3,
        costEscalationPreset: "custom" as const,
        costEscalations: createDefaultCostEscalations(),
        productPriceGrowth: [
          {
            productId: pack8.id,
            annualIncreasePct: 5,
            firstIncreaseMonth: 13,
          },
        ],
        forecastTimeline: [],
      },
    };

    const flat = runMonthlyProjection(base, 24);
    const growing = runMonthlyProjection(withGrowth, 24);

    const flatY2 = aggregateYearlyPL(flat, 2).years[1].netRevenue;
    const growY2 = aggregateYearlyPL(growing, 2).years[1].netRevenue;

    expect(growY2.gt(flatY2)).toBe(true);
  });

  it("resolveForecastSettings applies base preset defaults", () => {
    const settings = resolveForecastSettings(createSampleAssumptions());
    const payroll = settings.costEscalations.find((r) => r.categoryId === "payroll");
    expect(payroll?.annualPct).toBe(9);
  });
});
