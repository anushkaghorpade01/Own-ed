import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import {
  evaluateSalesPlan,
  suggestSalesMixFromServiceDemand,
  calculatePlanningNetProfitFromSales,
  calculateDeliveryFeasibility,
  buildServiceDemandMixPct,
} from "../engine/sales-client-target";
import { autoBalanceServiceDemandMix } from "../engine/service-demand-mix";

describe("Sales plan vs service demand mix separation", () => {
  it("changing service demand mix does not alter manual sales plan evaluation", () => {
    const base = createSampleAssumptions();
    const manualQty = {
      "drop-in": 6,
      "8-pack": 15,
      "16-pack": 3,
      "private-session": 2,
    } as Record<string, number>;
    const before = evaluateSalesPlan(base, manualQty, 8, 200_000);

    const dropIn = base.products.find((p) => p.id === "drop-in")!;
    const shifted = autoBalanceServiceDemandMix(base.products, dropIn.id, 50);
    const afterAssumptions = { ...base, products: shifted };
    const after = evaluateSalesPlan(afterAssumptions, manualQty, 8, 200_000);

    expect(after.netSales.toNumber()).toBeCloseTo(before.netSales.toNumber(), 0);
    expect(after.planningNetProfit.toNumber()).toBeCloseTo(
      before.planningNetProfit.toNumber(),
      0
    );
  });

  it("suggest from service mix populates quantities", () => {
    const base = createSampleAssumptions();
    const suggested = suggestSalesMixFromServiceDemand(base, 200_000, 8);
    const withSales = Object.values(suggested).filter((q) => q > 0);
    expect(withSales.length).toBeGreaterThan(0);
  });

  it("changing validity does not change commercial net sales for unchanged sales plan", () => {
    const base = createSampleAssumptions();
    const qty = { "8-pack": 10 };
    const commercialBefore = calculatePlanningNetProfitFromSales(base, qty, 8);

    const pack = base.products.find((p) => p.id === "8-pack")!;
    const longerValidity = base.products.map((p) =>
      p.id === "8-pack" && p.packRules
        ? {
            ...p,
            packRules: { ...p.packRules, validityValue: 16, validityUnit: "weeks" as const },
          }
        : p
    );
    const commercialAfter = calculatePlanningNetProfitFromSales(
      { ...base, products: longerValidity },
      qty,
      8
    );

    expect(commercialAfter.netSales.toNumber()).toBeCloseTo(
      commercialBefore.netSales.toNumber(),
      0
    );
  });

  it("changing redemption assumptions changes capacity but not commercial net sales", () => {
    const base = createSampleAssumptions();
    const qty = { "8-pack": 20 };
    const commercial = calculatePlanningNetProfitFromSales(base, qty, 8);

    const pack = base.products.find((p) => p.id === "8-pack")!;
    const higherRedemption = base.products.map((p) =>
      p.id === "8-pack" && p.packRules
        ? { ...p, packRules: { ...p.packRules, expectedRedemptionRatePct: 95 } }
        : p
    );
    const assumptions2 = { ...base, products: higherRedemption };
    const commercial2 = calculatePlanningNetProfitFromSales(assumptions2, qty, 8);
    expect(commercial2.netSales.toNumber()).toBeCloseTo(commercial.netSales.toNumber(), 0);

    const delivery1 = calculateDeliveryFeasibility(
      base,
      qty,
      8,
      base.salesTargetPreferences!
    );
    const delivery2 = calculateDeliveryFeasibility(
      assumptions2,
      qty,
      8,
      base.salesTargetPreferences!
    );
    expect(delivery2.totalReformerDemand.toNumber()).toBeGreaterThanOrEqual(
      delivery1.totalReformerDemand.toNumber()
    );
  });

  it("aggressive plan can be profitable while capacity is not feasible", () => {
    const base = createSampleAssumptions();
    const aggressive = { "8-pack": 200, "16-pack": 50, "drop-in": 100 };
    const sol = evaluateSalesPlan(base, aggressive, 8, 50_000);
    if (sol.planningNetProfit.toNumber() >= 50_000) {
      expect(["tight", "not_feasible"]).toContain(sol.delivery.capacityStatus);
    }
  });

  it("buildServiceDemandMixPct sums to ~100", () => {
    const mix = buildServiceDemandMixPct(createSampleAssumptions());
    const total = Object.values(mix).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100, 0);
  });
});
