import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import {
  analyzeFlexiblePack,
  listFlexiblePacks,
  estimateSafePackSales,
  validityInWeeks,
  resolvePackRules,
} from "../engine/flexible-packs";
import { buildCreditLedgerFromAssumptions } from "../engine/credit-ledger";
import { calculateCreditHealth } from "../engine/credit-health";
import { calculateCapacity } from "../engine/capacity";
import { migrateLegacyProducts } from "../engine/product-migration";
import { d } from "../decimal";

describe("Flexible packs engine", () => {
  const assumptions = createSampleAssumptions();
  const capacity = calculateCapacity(assumptions);

  it("lists 8 and 16 credit packs (not 4/12 legacy)", () => {
    const packs = listFlexiblePacks(assumptions);
    const credits = packs.map((p) => p.creditsIncluded);
    expect(credits).toContain(8);
    expect(credits).toContain(16);
    expect(credits).not.toContain(4);
    expect(credits).not.toContain(12);
  });

  it("computes net price per credit for 8-pack", () => {
    const pack = listFlexiblePacks(assumptions).find((p) => p.creditsIncluded === 8)!;
    const econ = analyzeFlexiblePack(pack, assumptions);
    expect(econ.netPerCredit.times(8).toNumber()).toBeCloseTo(econ.netPackageValue.toNumber(), 0);
  });

  it("customer pays net × (1 + GST) — never double-GST", () => {
    const pack = listFlexiblePacks(assumptions).find((p) => p.creditsIncluded === 8)!;
    const econ = analyzeFlexiblePack(pack, assumptions);
    expect(econ.netPackageValue.toNumber()).toBe(11525);
    expect(econ.grossPrice.toNumber()).toBeCloseTo(13600, -1);
    expect(econ.grossPrice.toNumber()).not.toBeCloseTo(11525 * 1.18 * 1.18, 0);
  });

  it("uses week-based validity (8 weeks for 8-pack)", () => {
    const pack = listFlexiblePacks(assumptions).find((p) => p.creditsIncluded === 8)!;
    const rules = resolvePackRules(pack);
    expect(validityInWeeks(rules).toNumber()).toBe(8);
  });

  it("net sales equal full package value regardless of redemption", () => {
    const pack = listFlexiblePacks(assumptions).find((p) => p.creditsIncluded === 16)!;
    const econ = analyzeFlexiblePack(pack, assumptions);
    expect(econ.expectedEarnedRevenue.toFixed(2)).toBe(econ.netPackageValue.toFixed(2));
    expect(econ.deferredUnearnedRevenue.toNumber()).toBe(0);
    expect(econ.expectedCreditsUnused.gt(0)).toBe(true);
  });

  it("lower redemption improves contribution via lower delivery cost", () => {
    const pack = listFlexiblePacks(assumptions).find((p) => p.creditsIncluded === 8)!;
    const highRedemption = analyzeFlexiblePack(pack, assumptions);
    const lowRedemptionProduct = {
      ...pack,
      packRules: pack.packRules
        ? { ...pack.packRules, expectedRedemptionRatePct: 50 }
        : pack.packRules,
    };
    const lowRedemption = analyzeFlexiblePack(lowRedemptionProduct, assumptions);
    expect(lowRedemption.netPackageValue.toFixed(2)).toBe(highRedemption.netPackageValue.toFixed(2));
    expect(lowRedemption.expectedContribution.gt(highRedemption.expectedContribution)).toBe(true);
  });

  it("credit ledger reconciles purchased = redeemed + expired + remaining", () => {
    const ledger = buildCreditLedgerFromAssumptions(assumptions);
    for (const c of ledger.cohorts) {
      expect(c.reconciles).toBe(true);
      expect(c.creditsRemaining.gte(0)).toBe(true);
    }
  });

  it("safe pack sales returns founder-friendly status", () => {
    const pack = listFlexiblePacks(assumptions).find((p) => p.creditsIncluded === 8)!;
    const health = calculateCreditHealth(assumptions, capacity);
    const result = estimateSafePackSales({
      product: pack,
      assumptions,
      additionalPacksToSell: 10,
      currentOutstandingCredits: health.creditsOutstanding,
      eligibleFlexibleCapacitySessions: health.eligibleFlexibleCapacity,
      eligiblePeakFlexibleCapacitySessions: health.eligiblePeakFlexibleCapacity,
    });
    expect(result.creditsAdded.toNumber()).toBe(80);
    expect(["comfortable", "tight", "overcommitted"]).toContain(result.status);
    expect(result.capacityCoverageRatio.lte(200)).toBe(true);
  });

  it("migrates legacy 4-pack and 12-pack", () => {
    const legacy = [
      {
        id: "4-pack",
        name: "4-credit pack",
        type: "credit_pack" as const,
        price: 7200,
        creditsIncluded: 4,
        validityDays: 30,
        packageMixPct: 30,
        gstTreatment: "inclusive" as const,
        gstFollowsGlobal: true,
        classEligibility: [],
        peakEligible: true,
        recurring: false,
        discountPct: 0,
        standingSpotMaxSeatsPerClass: 1,
      },
      {
        id: "12-pack",
        name: "12-credit pack",
        type: "credit_pack" as const,
        price: 19200,
        creditsIncluded: 12,
        validityDays: 90,
        packageMixPct: 15,
        gstTreatment: "inclusive" as const,
        gstFollowsGlobal: true,
        classEligibility: [],
        peakEligible: true,
        recurring: false,
        discountPct: 0,
        standingSpotMaxSeatsPerClass: 1,
      },
    ];
    const { products, flags } = migrateLegacyProducts(legacy);
    expect(flags.length).toBeGreaterThan(0);
    expect(products.some((p) => p.id === "16-pack" && p.creditsIncluded === 16)).toBe(true);
  });
});
