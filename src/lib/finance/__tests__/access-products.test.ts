import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { calculateCapacity } from "../engine/capacity";
import {
  calculateAccessProducts,
  analyzeFlexibleCreditPack,
  analyzeStandingSpotAccess,
  ACCESS_PRODUCT_FORMULAS,
} from "../engine/access-products";
import { expectedFlexibleContribution, contributionPerSession } from "../engine/contribution";
import { simulateStandbyAccessEconomics } from "../engine/standby";
import { d } from "../decimal";

describe("Access Products engine", () => {
  const assumptions = createSampleAssumptions();
  const capacity = calculateCapacity(assumptions);

  it("calculates full access products model", () => {
    const result = calculateAccessProducts(assumptions, capacity);
    expect(result.products.length).toBeGreaterThanOrEqual(5);
    expect(result.flexiblePacks.length).toBeGreaterThanOrEqual(2);
    expect(result.creditHealth).toBeDefined();
    expect(result.creditLedger.cohorts.length).toBeGreaterThan(0);
    expect(result.productComparison.length).toBeGreaterThan(10);
    expect(result.accessProductMix.mixValid).toBe(true);
  });

  it("handles assumptions missing new private/duo duration fields (localStorage migration)", () => {
    const legacy = { ...createSampleAssumptions() } as Record<string, unknown>;
    delete legacy.privateDurationMinutes;
    delete legacy.duoDurationMinutes;
    delete legacy.privateReformersOccupied;
    delete legacy.duoReformersConsumed;
    const result = calculateAccessProducts(legacy as typeof assumptions, capacity);
    expect(result.products.some((p) => p.kind === "private")).toBe(true);
    expect(result.products.some((p) => p.kind === "duo")).toBe(true);
  });

  it("distinguishes three types of certainty for flexible pack", () => {
    const pack = analyzeFlexibleCreditPack(assumptions)!;
    expect(pack.predictability.cashCertainty).toBe("yes");
    expect(pack.predictability.classOccupancyCertainty).toBe("no");
    expect(pack.predictability.futurePeriodRevenueVisibility).toBe("no");
  });

  it("distinguishes three types of certainty for standing spot", () => {
    const ss = analyzeStandingSpotAccess(assumptions, capacity.monthlyAvailableSeats)!;
    expect(ss.predictability.classOccupancyCertainty).toBe("yes");
    expect(ss.predictability.futurePeriodRevenueVisibility).toBe("yes");
    expect(ss.financialOutputs.capacityReservationValue).toBeDefined();
  });

  it("calculates expected flexible contribution correctly", () => {
    const contributionWhenOccupied = d(1500);
    const expected = expectedFlexibleContribution(contributionWhenOccupied, 80);
    expect(expected.toNumber()).toBe(1200);
  });

  it("provides standing spot sensitivity matrix", () => {
    const ss = analyzeStandingSpotAccess(assumptions, capacity.monthlyAvailableSeats)!;
    expect(ss.sensitivity.fillProbabilities).toEqual([40, 60, 80, 90, 100]);
    expect(ss.sensitivity.premiumPcts).toEqual([0, 5, 10, 15, 20]);
    expect(ss.sensitivity.cells.length).toBe(5);
    expect(ss.sensitivity.cells[0].length).toBe(5);
  });

  it("includes premium scenarios without hardcoding a required premium", () => {
    const ss = analyzeStandingSpotAccess(assumptions, capacity.monthlyAvailableSeats)!;
    expect(ss.premiumScenarios.some((s) => s.premiumPct === 0)).toBe(true);
    expect(ss.premiumScenarios.some((s) => s.premiumPct === 15)).toBe(true);
  });

  it("calculates standby break-even cannibalisation", () => {
    const standby = assumptions.products.find((p) => p.type === "standby")!;
    const sim = simulateStandbyAccessEconomics(assumptions, standby);
    expect(sim.estimatedDisplacedRegularContribution).toBeDefined();
    expect(sim.breakEvenCannibalisationPct.gte(0)).toBe(true);
    expect(sim.breakEvenExplanation).toContain("not certain lost revenue");
  });

  it("documents formulas in registry constant", () => {
    expect(ACCESS_PRODUCT_FORMULAS.capacityReservationValue).toContain("expectedFlexibleContribution");
    expect(ACCESS_PRODUCT_FORMULAS.breakEvenCannibalisation).toContain("standbyContributionPerClaim");
  });

  it("includes narrative sections for each product", () => {
    const result = calculateAccessProducts(assumptions, capacity);
    for (const product of result.products) {
      expect(product.narrative.howItWorks.length).toBeGreaterThan(0);
      expect(product.narrative.whatCustomerGets.length).toBeGreaterThan(0);
      expect(product.narrative.whatOwnGets.length).toBeGreaterThan(0);
      expect(product.narrative.whatOwnGivesUp.length).toBeGreaterThan(0);
      expect(product.narrative.risks.length).toBeGreaterThan(0);
    }
  });

  it("calculates credit pack planning economics", () => {
    const pack = analyzeFlexibleCreditPack(assumptions)!;
    expect(pack.financialOutputs.netPackageValue.gt(0)).toBe(true);
    expect(pack.financialOutputs.expectedContribution.gt(0)).toBe(true);
    expect(pack.financialOutputs.contributionPerRedeemedCredit.gt(0)).toBe(true);
  });

  it("uses contribution not sticker revenue for standing spot comparison", () => {
    const ss = analyzeStandingSpotAccess(assumptions, capacity.monthlyAvailableSeats)!;
    const netPerSession = ss.financialOutputs.netRevenuePerReservedSession;
    const expectedContrib = contributionPerSession(assumptions, netPerSession);
    expect(ss.financialOutputs.standingSpotContribution.gt(0)).toBe(true);
    expect(expectedContrib.gt(0)).toBe(true);
  });
});
