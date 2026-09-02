import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../index";
import {
  productNetPrice,
  productGrossPrice,
  getEffectiveGstMode,
} from "../engine/revenue";
import { migratePricingSemantics } from "../engine/pricing-migration";
import { normalizeAssumptions } from "../validation";

describe("Net ex-GST pricing", () => {
  it("product.price is net sales — customer pays adds GST", () => {
    const base = createSampleAssumptions();
    const dropIn = base.products.find((p) => p.type === "drop_in")!;
    const net = productNetPrice(dropIn, base);
    const gross = productGrossPrice(dropIn, base);
    expect(net.toNumber()).toBe(1695);
    expect(gross.toNumber()).toBeCloseTo(2000, 0);
  });

  it("always uses exclusive entry mode", () => {
    const base = createSampleAssumptions();
    expect(getEffectiveGstMode(base.products[0], base)).toBe("exclusive");
  });

  it("migrates legacy inclusive prices preserving customer pays", () => {
    const legacy = {
      ...createSampleAssumptions(),
      pricingSemanticsVersion: 1,
      priceEntryMode: "inclusive" as const,
      products: createSampleAssumptions().products.map((p) =>
        p.id === "8-pack" ? { ...p, price: 13600, gstTreatment: "inclusive" as const } : p
      ),
    };
    const migrated = migratePricingSemantics(legacy);
    const pack = migrated.products.find((p) => p.id === "8-pack")!;
    expect(pack.price).toBeCloseTo(11525, 0);
    const gross = productGrossPrice(pack, migrated);
    expect(gross.toNumber()).toBeCloseTo(13600, -1);
  });

  it("normalizes saved assumptions through migration", () => {
    const raw = {
      ...createSampleAssumptions(),
      pricingSemanticsVersion: 1,
      priceEntryMode: "inclusive" as const,
    };
    const normalized = normalizeAssumptions(raw);
    expect(normalized.pricingSemanticsVersion).toBe(2);
    expect(normalized.priceEntryMode).toBe("exclusive");
  });

  it("private sample net price is 4000", () => {
    const base = createSampleAssumptions();
    const privateP = base.products.find((p) => p.type === "private")!;
    expect(productNetPrice(privateP, base).toNumber()).toBe(4000);
    expect(productGrossPrice(privateP, base).toNumber()).toBeCloseTo(4720, 0);
  });
});

describe("Custom expenses", () => {
  it("includes custom fixed expenses in operating costs", () => {
    const base = createSampleAssumptions();
    const withCustom = runFinanceModel({
      ...base,
      customExpenses: [{ id: "1", name: "Pest control", amount: 5000, category: "fixed" }],
    });
    const without = runFinanceModel(base);
    expect(withCustom.operatingExpenses.totalOperatingExpenses.minus(without.operatingExpenses.totalOperatingExpenses).toFixed(0)).toBe("5000");
  });

  it("includes custom variable expenses in direct costs", () => {
    const base = createSampleAssumptions();
    const withCustom = runFinanceModel({
      ...base,
      customExpenses: [{ id: "2", name: "Spotify", amount: 2000, category: "variable" }],
    });
    const without = runFinanceModel(base);
    expect(withCustom.directCosts.totalDirectCosts.minus(without.directCosts.totalDirectCosts).toFixed(0)).toBe("2000");
  });
});

describe("Occupancy reactivity", () => {
  it("increases revenue when occupancy rises", () => {
    const low = runFinanceModel({ ...createSampleAssumptions(), projectedBookedOccupancyPct: 40 });
    const high = runFinanceModel({ ...createSampleAssumptions(), projectedBookedOccupancyPct: 80 });
    expect(high.revenue.netRevenue.gt(low.revenue.netRevenue)).toBe(true);
  });

  it("increases break-even required seats when rent rises", () => {
    const base = runFinanceModel(createSampleAssumptions());
    const highRent = runFinanceModel({ ...createSampleAssumptions(), rent: 130000 });
    expect(highRent.breakEven.contributionBreakEven.breakEvenOccupancyPct.gt(base.breakEven.contributionBreakEven.breakEvenOccupancyPct)).toBe(true);
  });
});

describe("Payback uses operating cash flow", () => {
  it("tracks cumulative free cash flow not bank balance", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const month1 = model.cashFlow.monthly[0];
    expect(month1.recoveryPosition.lt(month1.bankCashBalance)).toBe(true);
  });
});

describe("Package mix validation", () => {
  it("flags invalid service demand mix", () => {
    const base = createSampleAssumptions();
    const bad = {
      ...base,
      products: base.products.map((p) =>
        p.id === "drop-in" ? { ...p, serviceDemandPct: 50, packageMixPct: 50 } : p
      ),
    };
    const model = runFinanceModel(bad);
    expect(model.validationErrors.some((e) => e.message.includes("100%"))).toBe(true);
  });
});

describe("Rent sensitivity", () => {
  it("reduces EBITDA when rent increases to 1.3L", () => {
    const base = runFinanceModel(createSampleAssumptions());
    const highRent = runFinanceModel({ ...createSampleAssumptions(), rent: 130000 });
    expect(highRent.pl.ebitda.lt(base.pl.ebitda)).toBe(true);
    expect(base.pl.ebitda.minus(highRent.pl.ebitda).toFixed(0)).toBe("40000");
  });
});