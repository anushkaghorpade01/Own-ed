import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { d } from "../decimal";
import {
  calculateWeightedRealisedRevenue,
  productGrossRevenuePerCredit,
  productNetRevenuePerCredit,
} from "../engine/revenue";
import {
  calculateFlexibleCreditMix,
  listActiveFlexibleSkus,
} from "../engine/flexible-mix";
import { autoBalanceServiceDemandMix } from "../engine/service-demand-mix";
import {
  deduplicateFlexibleSkus,
  migrateLegacyProducts,
} from "../engine/product-migration";
import { createSampleAssumptions } from "../sample-data";
import type { FinanceAssumptions, Product } from "../schemas";
import { ensureProductVersionFields } from "../engine/product-catalog";

function buildRegressionAssumptions(): FinanceAssumptions {
  const base = createSampleAssumptions();
  const products = base.products.map((p) => {
    if (p.id === "drop-in") {
      return {
        ...p,
        price: 1695,
        creditsIncluded: 1,
        packageMixPct: 50,
        packRules: p.packRules
          ? { ...p.packRules, expectedRedemptionRatePct: 100 }
          : p.packRules,
      };
    }
    if (p.id === "8-pack") {
      return {
        ...p,
        price: 11525,
        creditsIncluded: 8,
        packageMixPct: 50,
        packRules: p.packRules
          ? { ...p.packRules, expectedRedemptionRatePct: 100 }
          : p.packRules,
      };
    }
    return { ...p, packageMixPct: 0 };
  });
  return { ...base, products };
}

describe("flexible SKU deduplication", () => {
  it("merges duplicate 1-credit SKUs into canonical drop-in", () => {
    const dropIn = ensureProductVersionFields({
      id: "drop-in",
      name: "Drop-in",
      type: "drop_in",
      price: 2000,
      gstTreatment: "inclusive",
      gstFollowsGlobal: true,
      creditsIncluded: 1,
      packageMixPct: 20,
      peakEligible: true,
      recurring: false,
      discountPct: 0,
      classEligibility: [],
      standingSpotMaxSeatsPerClass: 1,
    });
    const legacy = ensureProductVersionFields({
      id: "1-credit",
      name: "Drop-in credit",
      type: "credit_pack",
      price: 2000,
      gstTreatment: "inclusive",
      gstFollowsGlobal: true,
      creditsIncluded: 1,
      packageMixPct: 10,
      peakEligible: true,
      recurring: false,
      discountPct: 0,
      classEligibility: [],
      standingSpotMaxSeatsPerClass: 1,
    });
    const eightPack = ensureProductVersionFields({
      id: "8-pack",
      name: "8 Credit Pack",
      type: "credit_pack",
      price: 13600,
      gstTreatment: "inclusive",
      gstFollowsGlobal: true,
      creditsIncluded: 8,
      packageMixPct: 70,
      peakEligible: true,
      recurring: false,
      discountPct: 0,
      classEligibility: [],
      standingSpotMaxSeatsPerClass: 1,
    });

    const { products } = deduplicateFlexibleSkus([dropIn, legacy, eightPack]);
    const oneCreditSkus = products.filter(
      (p) => p.type === "drop_in" || (p.type === "credit_pack" && p.creditsIncluded === 1)
    );

    expect(oneCreditSkus).toHaveLength(1);
    expect(oneCreditSkus[0].id).toBe("drop-in");
    expect(oneCreditSkus[0].name).toBe("Drop-in");
    expect(oneCreditSkus[0].packageMixPct).toBe(30);
  });

  it("migrates legacy 4-pack to drop-in without creating 1-credit", () => {
    const { products } = migrateLegacyProducts([
      ensureProductVersionFields({
        id: "drop-in",
        name: "Drop-in",
        type: "drop_in",
        price: 2000,
        gstTreatment: "inclusive",
        gstFollowsGlobal: true,
        creditsIncluded: 1,
        packageMixPct: 20,
        peakEligible: true,
        recurring: false,
        discountPct: 0,
        classEligibility: [],
        standingSpotMaxSeatsPerClass: 1,
      }),
      ensureProductVersionFields({
        id: "4-pack",
        name: "4 Credit Pack",
        type: "credit_pack",
        price: 2000,
        gstTreatment: "inclusive",
        gstFollowsGlobal: true,
        creditsIncluded: 4,
        packageMixPct: 10,
        peakEligible: true,
        recurring: false,
        discountPct: 0,
        classEligibility: [],
        standingSpotMaxSeatsPerClass: 1,
      }),
    ]);

    expect(products.some((p) => p.id === "1-credit")).toBe(false);
    expect(products.filter((p) => p.id === "drop-in")).toHaveLength(1);
  });
});

describe("per-credit pricing", () => {
  it("never uses package price as per-credit price", () => {
    const assumptions = buildRegressionAssumptions();
    const eightPack = assumptions.products.find((p) => p.id === "8-pack")!;

    const netPerCredit = productNetRevenuePerCredit(eightPack, assumptions);
    const grossPerCredit = productGrossRevenuePerCredit(eightPack, assumptions);

    expect(netPerCredit.toNumber()).toBeCloseTo(11525 / 8, 0);
    expect(grossPerCredit.toNumber()).toBeCloseTo((11525 / 8) * 1.18, 0);
    expect(netPerCredit.toNumber()).not.toBe(13600);
    expect(grossPerCredit.toNumber()).not.toBe(13600);
  });
});

describe("customer mix vs credit mix", () => {
  it("derives distinct customer and credit mix percentages", () => {
    const assumptions = buildRegressionAssumptions();
    const mix = calculateFlexibleCreditMix(assumptions);

    expect(mix.customerMixTotal.toNumber()).toBe(100);
    expect(mix.creditMixTotal.toNumber()).toBeCloseTo(100, 5);

    const dropIn = mix.rows.find((r) => r.product.id === "drop-in")!;
    const eightPack = mix.rows.find((r) => r.product.id === "8-pack")!;

    expect(dropIn.flexibleCustomerMixPct.toNumber()).toBe(50);
    expect(eightPack.flexibleCustomerMixPct.toNumber()).toBe(50);
    expect(dropIn.flexibleCreditMixPct.toNumber()).toBeCloseTo(11.111111, 4);
    expect(eightPack.flexibleCreditMixPct.toNumber()).toBeCloseTo(88.888889, 4);
  });
});

describe("weighted realised revenue regression", () => {
  it("uses service booking mix for weighted group net sales", () => {
    const assumptions = buildRegressionAssumptions();
    const weighted = calculateWeightedRealisedRevenue(assumptions);
    const economics = weighted.serviceBookingBreakdown;

    const handGroup = economics
      .filter((r) => r.product.type !== "private")
      .reduce((s, r) => s + r.weightedNetSalesImpact.toNumber(), 0);

    expect(weighted.weightedGroupNetSalesPerOccupiedSpot.toNumber()).toBeCloseTo(handGroup, 0);
    expect(weighted.blendedNetSalesPerOccupiedSpot.gt(weighted.weightedGroupNetSalesPerOccupiedSpot)).toBe(
      true
    );
    expect(weighted.mixTotal.toNumber()).toBeCloseTo(100, 1);
  });

  it("derives SKUs from active product config only", () => {
    const assumptions = createSampleAssumptions();
    const skus = listActiveFlexibleSkus(assumptions);
    expect(skus.some((p) => p.id === "1-credit")).toBe(false);
    expect(skus.every((p) => p.creditsIncluded >= 1)).toBe(true);
  });

  it("requires service demand mix to total 100%", () => {
    const assumptions = createSampleAssumptions();
    const skewed = {
      ...assumptions,
      products: assumptions.products.map((p) =>
        p.id === "drop-in" ? { ...p, serviceDemandPct: 30 } : p
      ),
    };

    const before = calculateWeightedRealisedRevenue(skewed);
    expect(before.mixValid).toBe(false);

    const after = calculateWeightedRealisedRevenue({
      ...assumptions,
      products: autoBalanceServiceDemandMix(skewed.products, "drop-in", 30),
    });
    expect(after.mixValid).toBe(true);
    expect(after.mixTotal.toNumber()).toBeCloseTo(100, 1);
  });
});
