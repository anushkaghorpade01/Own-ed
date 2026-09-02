import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { createSampleAssumptions } from "../sample-data";
import { ensureProductVersionFields } from "../engine/product-catalog";
import type { FinanceAssumptions } from "../schemas";
import { SalesTargetPreferencesSchema } from "../schemas";
import {
  calculateDeliveryFeasibility,
  calculateExistingCreditDemandThisMonth,
  calculatePlanningNetProfitFromSales,
  calculateClientBaseRequirement,
  computeProductCommercialEconomics,
  getCoreSalesProducts,
  getSteadyStatePlNetSales,
  runSalesTargetAnalysis,
  solveSalesForProfitTarget,
  suggestSalesMixFromServiceDemand,
  suggestSalesMixForNetSalesTarget,
  calculateCommercialTotals,
} from "../engine/sales-client-target";
import {
  expectedCreditsRedeemedInMonth,
  analyzeFlexiblePack,
} from "../engine/flexible-packs";
import { calculateCapacity } from "../engine/capacity";
import { d } from "../decimal";

function privateOnlyAssumptions(): FinanceAssumptions {
  const privateProduct = ensureProductVersionFields({
    id: "private-test",
    name: "Private",
    type: "private",
    price: 5000,
    gstTreatment: "exclusive",
    gstFollowsGlobal: false,
    creditsIncluded: 0,
    packageMixPct: 100,
    serviceDemandPct: 100,
    peakEligible: true,
    recurring: false,
    discountPct: 0,
    classEligibility: [],
    standingSpotMaxSeatsPerClass: 1,
    privateRules: {
      durationMinutes: 60,
      clientsPerSession: 1,
      instructorCostPerHour: 1000,
      otherDirectVariableCost: 0,
      reformersOccupied: 1,
    },
  });

  const base = createSampleAssumptions();
  return {
    ...base,
    incomeTaxRatePct: 0,
    loanAmount: 0,
    depreciationAssets: [],
    products: [privateProduct],
    rent: 100_000,
    camMaintenance: 0,
    ownerInstructorSalary: 0,
    additionalInstructorSalary: 0,
    cleanerSalary: 0,
    receptionSalary: 0,
    security: 0,
    internet: 0,
    softwareSubscriptions: 0,
    accounting: 0,
    insurance: 0,
    fixedMarketingRetainer: 0,
    licences: 0,
    otherFixedCosts: 0,
    electricityBase: 0,
    electricityVariablePerClass: 0,
    laundry: 0,
    water: 0,
    cleaningSupplies: 0,
    sessionConsumables: 0,
    instructorPerClassPayout: 0,
    instructorPerAttendeePayout: 0,
    paymentGatewayPct: 0,
    privateSessionsPerMonth: 0,
    projectedBookedOccupancyPct: 0,
    customExpenses: [],
    customerAcquisitionSpend: 0,
    repairsReserve: 0,
    miscVariableCosts: 0,
    refreshments: 0,
    includeOwnerMarketRateComp: false,
    workshopCountPerMonth: 0,
    duoSessionsPerMonth: 0,
    otherRevenuePerMonth: 0,
    salesTargetPreferences: SalesTargetPreferencesSchema.parse({
      targetMonthlyNetProfit: 50_000,
      targetMonth: 1,
      solutionMode: "profit_maximising",
      salesMixMode: "auto",
    }),
  };
}

describe("Sales & Client Target engine", () => {
  it("commercial test: Private-only profit target (spec §50)", () => {
    const assumptions = privateOnlyAssumptions();
    const products = getCoreSalesProducts(assumptions);
    expect(products).toHaveLength(1);

    const econ = computeProductCommercialEconomics(products[0], assumptions);
    expect(econ.contributionPerSale.toNumber()).toBeCloseTo(4000, 0);

    const quantities = solveSalesForProfitTarget(
      assumptions,
      50_000,
      "profit_maximising",
      1
    );
    expect(quantities["private-test"]).toBe(38);

    const pl = calculatePlanningNetProfitFromSales(assumptions, quantities, 1);
    expect(pl.netProfit.toNumber()).toBeGreaterThanOrEqual(50_000);
    expect(pl.netProfit.toNumber()).toBeCloseTo(52_000, -2);
  });

  it("pack capacity: redemptions spread across months, not all in month 1 (spec §51)", () => {
    const eightPack = ensureProductVersionFields({
      id: "8-pack-test",
      name: "8-Pack",
      type: "credit_pack",
      price: 11525,
      gstTreatment: "exclusive",
      gstFollowsGlobal: true,
      creditsIncluded: 8,
      packageMixPct: 100,
      serviceDemandPct: 100,
      peakEligible: true,
      recurring: false,
      discountPct: 0,
      classEligibility: [],
      standingSpotMaxSeatsPerClass: 1,
      packRules: {
        validityValue: 8,
        validityUnit: "weeks",
        validityBeginsFrom: "activation",
        activationDeadlineDays: 30,
        activationPolicy: "expire_if_not_activated",
        eligibleClassTypes: [],
        eligibleTimeBands: ["peak", "standard", "off_peak"],
        expectedRedemptionRatePct: 80,
        expectedBreakageRatePct: 0,
        expectedCancellationRatePct: 0,
        expectedNoShowRatePct: 0,
        expectedPeakBookingSharePct: 50,
        transferable: false,
        refundable: false,
        expectedSalesVolumePerMonth: 0,
        active: true,
        displayOrder: 1,
      },
    });

    const assumptions = {
      ...createSampleAssumptions(),
      products: [eightPack],
    };

    const month0 = expectedCreditsRedeemedInMonth(eightPack, assumptions, 10, 0);
    const month1 = expectedCreditsRedeemedInMonth(eightPack, assumptions, 10, 1);
    const totalExpected = analyzeFlexiblePack(eightPack, assumptions).expectedCreditsRedeemed.times(
      10
    );

    expect(month0.toNumber()).toBeLessThan(totalExpected.toNumber());
    expect(month0.toNumber()).toBeLessThan(80);
    expect(month0.toNumber()).toBeGreaterThan(0);
    expect(month1.toNumber()).toBeGreaterThan(0);
    expect(month0.toNumber()).not.toBe(80);
  });

  it("drop-in: 1 purchase = 1 credit = 1 booking (spec §52)", () => {
    const base = createSampleAssumptions();
    const dropIn = base.products.find((p) => p.id === "drop-in")!;
    const month0 = expectedCreditsRedeemedInMonth(dropIn, base, 20, 0);
    expect(month0.toNumber()).toBe(20);

    const delivery = calculateDeliveryFeasibility(
      base,
      { "drop-in": 20 },
      1,
      base.salesTargetPreferences!
    );
    expect(delivery.creditsSold.toNumber()).toBe(20);
    expect(delivery.expectedRedemptionsFromNewSales.toNumber()).toBe(20);
  });

  it("private: sessions ≠ unique clients (spec §53)", () => {
    const assumptions = privateOnlyAssumptions();
    const quantities = solveSalesForProfitTarget(
      assumptions,
      50_000,
      "profit_maximising",
      1
    );
    const privateQty = quantities["private-test"] ?? 0;
    expect(privateQty).toBeGreaterThanOrEqual(37);
    const clients = calculateClientBaseRequirement(
      assumptions,
      quantities,
      { ...assumptions.salesTargetPreferences!, avgPrivateSessionsPerClientMonth: 4 }
    );
    const unique = clients.estimatedUniqueActiveClients.toNumber();
    expect(unique).toBeCloseTo(privateQty / 4, 0);
    expect(unique).toBeLessThan(privateQty);
  });

  it("existing credits included in reformer demand (spec §54)", () => {
    const base = createSampleAssumptions();
    const assumptions = {
      ...base,
      creditsSoldOutstanding: 200,
      creditsExpectedRedemptionBeforeExpiry: 160,
    };

    const newSalesQty = { "8-pack": 10 };
    const delivery = calculateDeliveryFeasibility(
      assumptions,
      newSalesQty,
      1,
      base.salesTargetPreferences!
    );

    const existing = calculateExistingCreditDemandThisMonth(assumptions);
    expect(existing.toNumber()).toBeGreaterThan(0);

    const manualTotal = delivery.expectedRedemptionsFromNewSales
      .plus(existing)
      .plus(delivery.privateBookings);
    expect(delivery.totalReformerDemand.toNumber()).toBeCloseTo(
      manualTotal.toNumber(),
      0
    );

    const capacity = calculateCapacity(assumptions, new Decimal(0));
    const implied = delivery.totalReformerDemand.dividedBy(capacity.monthlyAvailableSeats).times(100);
    expect(delivery.impliedOccupancyPct.toNumber()).toBeCloseTo(implied.toNumber(), 1);
  });

  it("dynamic changes: higher target increases sales requirement (spec §55)", () => {
    const assumptions = privateOnlyAssumptions();
    const low = solveSalesForProfitTarget(assumptions, 50_000, "profit_maximising", 1);
    const high = solveSalesForProfitTarget(assumptions, 100_000, "profit_maximising", 1);
    expect(high["private-test"]).toBeGreaterThan(low["private-test"]!);
  });

  it("reconciliation: product net sales sum to total (spec §56)", () => {
    const analysis = runSalesTargetAnalysis(createSampleAssumptions(), {
      targetMonthlyNetProfit: 200_000,
    });
    const sol = analysis.suggestedMix;
    const sumNet = sol.productRows.reduce(
      (acc, r) => acc.plus(r.netSales),
      new Decimal(0)
    );
    expect(sumNet.toNumber()).toBeCloseTo(sol.netSales.toNumber(), 0);

    const sumDirect = sol.productRows.reduce(
      (acc, r) => acc.plus(r.directCost),
      new Decimal(0)
    );
    expect(sumDirect.toNumber()).toBeCloseTo(sol.directCosts.toNumber(), 0);

    const recomputedEbitda = sol.netSales.minus(sol.directCosts).minus(sol.operatingExpenses);
    expect(sol.planningNetProfit.toNumber()).toBeLessThanOrEqual(
      recomputedEbitda.toNumber() + 1
    );
    expect(sol.planningNetProfit.toNumber()).toBeGreaterThan(
      recomputedEbitda.minus(sol.operatingExpenses.times(0.5)).toNumber()
    );
  });

  it("service mix suggestion uses multiple products, not one plan only", () => {
    const assumptions = createSampleAssumptions();
    const quantities = suggestSalesMixFromServiceDemand(assumptions, 200_000, 8);
    const productsWithSales = Object.entries(quantities).filter(([, q]) => q > 0);
    expect(productsWithSales.length).toBeGreaterThan(1);

    const dropInOnly = suggestSalesMixFromServiceDemand(assumptions, 200_000, 8);
    const greedySingle = solveSalesForProfitTarget(assumptions, 200_000, "lowest_client_count", 8);
    const dropInOnlyCount = Object.values(dropInOnly).filter((q) => q > 0).length;
    const greedySingleCount = Object.values(greedySingle).filter((q) => q > 0).length;
    expect(dropInOnlyCount).toBeGreaterThan(1);
    expect(greedySingleCount).toBeLessThanOrEqual(1);
  });

  it("net sales target solver reaches revenue goal with service demand mix", () => {
    const assumptions = createSampleAssumptions();
    const target = 500_000;
    const quantities = suggestSalesMixForNetSalesTarget(assumptions, target, 8);
    const commercial = calculateCommercialTotals(assumptions, quantities);

    expect(commercial.netSales.gte(target)).toBe(true);
    expect(Object.values(quantities).filter((q) => q > 0).length).toBeGreaterThan(1);
  });

  it("higher net sales target requires more sales units", () => {
    const assumptions = createSampleAssumptions();
    const low = suggestSalesMixForNetSalesTarget(assumptions, 300_000, 8);
    const high = suggestSalesMixForNetSalesTarget(assumptions, 700_000, 8);
    const sumUnits = (q: Record<string, number>) =>
      Object.values(q).reduce((a, b) => a + b, 0);
    expect(sumUnits(high)).toBeGreaterThan(sumUnits(low));
  });

  it("runSalesTargetAnalysis includes net sales plan defaulting to steady-state P&L", () => {
    const assumptions = createSampleAssumptions();
    const analysis = runSalesTargetAnalysis(assumptions, { targetMonth: 8 });
    const steady = getSteadyStatePlNetSales(assumptions);

    expect(analysis.netSalesPlan.targetNetSales.toNumber()).toBeCloseTo(steady.toNumber(), 0);
    expect(analysis.netSalesPlan.achievedNetSales.gte(analysis.netSalesPlan.targetNetSales)).toBe(
      true
    );
    expect(analysis.netSalesPlan.steadyStatePlNetSales.toNumber()).toBeCloseTo(
      steady.toNumber(),
      0
    );
  });

  it("custom net sales target overrides steady-state default", () => {
    const assumptions = createSampleAssumptions();
    const analysis = runSalesTargetAnalysis(assumptions, {
      targetMonthlyNetSales: 400_000,
      targetMonth: 8,
    });

    expect(analysis.netSalesPlan.targetNetSales.toNumber()).toBe(400_000);
    expect(analysis.netSalesPlan.achievedNetSales.gte(400_000)).toBe(true);
  });
});
