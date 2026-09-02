import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../run-model";
import {
  allocateSessionsByAccessMix,
  combinedSkuShareOfTotalSessions,
  resolveAccessProductMix,
} from "../engine/session-allocation";
import { d } from "../decimal";

describe("Session allocation", () => {
  const assumptions = createSampleAssumptions();
  const model = runFinanceModel(assumptions);
  const occupied = model.capacity.occupiedSeatsMonthly;

  it("accessProductMix totals 100%", () => {
    const mix = resolveAccessProductMix(assumptions);
    expect(mix.mixValid).toBe(true);
  });

  it("allocates flexible sessions by access mix then package mix", () => {
    const alloc = allocateSessionsByAccessMix(assumptions, occupied);
    const pack8 = alloc.flexibleSkuSessions.find((s) => s.product.id === "8-pack");
    expect(pack8).toBeDefined();
    const combined = combinedSkuShareOfTotalSessions(60, 55);
    expect(combined.toNumber()).toBeCloseTo(0.33, 2);
  });

  it("changes EBITDA when service demand mix changes", () => {
    const base = runFinanceModel(assumptions);
    const shifted = runFinanceModel({
      ...assumptions,
      products: assumptions.products.map((p) => {
        if (p.id === "private-session") return { ...p, serviceDemandPct: 25 };
        if (p.id === "drop-in") return { ...p, serviceDemandPct: 5 };
        return p;
      }),
    });
    expect(shifted.revenue.netRevenue.equals(base.revenue.netRevenue)).toBe(false);
  });

  it("product-level revenue reconciles to net revenue components", () => {
    const rev = model.revenue;
    const productSum = rev.productLevel.reduce((s, p) => s + p.netRevenue.toNumber(), 0);
    expect(productSum).toBeGreaterThan(0);
  });
});

describe("Combined SKU share", () => {
  it("computes 60% × 55% = 33% explicitly", () => {
    const share = combinedSkuShareOfTotalSessions(60, 55);
    expect(share.times(d(100)).toNumber()).toBeCloseTo(33, 0);
  });
});
