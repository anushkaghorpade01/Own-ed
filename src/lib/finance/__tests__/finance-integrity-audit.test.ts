/**
 * Finance integrity audit tests — propagation, reconciliation, golden model,
 * and independent cross-checks. Permanent regression suite for audit findings.
 */
import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { d } from "../decimal";
import { runFinanceModel } from "../run-model";
import { createSampleAssumptions } from "../sample-data";
import { calculateCapacity } from "../engine/capacity";
import {
  calculateWeightedRealisedRevenue,
  productNetRevenuePerCredit,
  productGrossRevenuePerCredit,
  productNetPrice,
} from "../engine/revenue";
import { autoBalanceServiceDemandMix } from "../engine/service-demand-mix";
import { analyzeFlexiblePack } from "../engine/flexible-packs";
import { ensureProductVersionFields } from "../engine/product-catalog";
import { validateAssumptions } from "../validation";
import { buildScenarioMetrics } from "../engine/scenarios";
import { calculateTargetGap } from "../engine/optimisation";
import type { FinanceAssumptions } from "../schemas";

function cloneAssumptions(): FinanceAssumptions {
  return structuredClone(createSampleAssumptions());
}

function snapshotKeyMetrics(model: ReturnType<typeof runFinanceModel>) {
  return {
    netRevenue: model.revenue.netRevenue.toFixed(2),
    weightedNet: model.revenue.weightedRevenue.weightedNetRevenuePerCredit.toFixed(2),
    ebitda: model.pl.ebitda.toFixed(2),
    monthlySeats: model.capacity.monthlyAvailableSeats.toFixed(2),
    occupied: model.capacity.occupiedSeatsMonthly.toFixed(2),
    breakEven: model.breakEven.contributionBreakEven.breakEvenOccupancyPct.toFixed(2),
    payback: model.payback.paybackMonth,
  };
}

describe("Golden Model — hand-verifiable baseline", () => {
  /**
   * Minimal model:
   * - 1 reformer × 1 class/day × 5 days = 5 seats/week
   * - Monthly seats = 5 × 52/12 = 21.666...
   * - 100% occupancy → 21.666 occupied seats
   * - Single drop-in product ₹1695 net ex-GST → customer pays ~₹2000
   * - accessProductMix: 100% flexible (via 100% drop-in channel is separate;
   *   use 100% flexible pack with only drop-in in mix for simplicity)
   */
  function buildGoldenAssumptions(): FinanceAssumptions {
    const dropIn = ensureProductVersionFields({
      id: "drop-in",
      name: "Drop-in",
      type: "drop_in",
      price: 1695,
      gstTreatment: "exclusive",
      gstFollowsGlobal: true,
      creditsIncluded: 1,
      packageMixPct: 100,
      serviceDemandPct: 100,
      peakEligible: true,
      recurring: false,
      discountPct: 0,
      classEligibility: [],
      standingSpotMaxSeatsPerClass: 1,
      packRules: {
        validityValue: 4,
        validityUnit: "weeks",
        validityBeginsFrom: "activation",
        activationDeadlineDays: 30,
        activationPolicy: "expire_if_not_activated",
        eligibleClassTypes: [],
        eligibleTimeBands: ["peak", "standard", "off_peak"],
        expectedRedemptionRatePct: 100,
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

    return {
      ...createSampleAssumptions(),
      reformers: 1,
      classesPerDay: 1,
      operatingDaysPerWeek: 5,
      projectedBookedOccupancyPct: 100,
      projectedAttendedOccupancyPct: 100,
      products: [dropIn],
      accessProductMix: {
        flexiblePackPct: 100,
        standingSpotPct: 0,
        dropInPct: 0,
        standbyPct: 0,
        privateDuoPct: 0,
        trialPct: 0,
      },
      privateSessionsPerMonth: 0,
      duoSessionsPerMonth: 0,
      workshopCountPerMonth: 0,
      otherRevenuePerMonth: 0,
      rent: 0,
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
      laundry: 0,
      water: 0,
      cleaningSupplies: 0,
      refreshments: 0,
      repairsReserve: 0,
      miscVariableCosts: 0,
      instructorPerClassPayout: 0,
      instructorPerAttendeePayout: 0,
      sessionConsumables: 0,
      paymentGatewayPct: 0,
      customerAcquisitionSpend: 0,
    };
  }

  it("capacity: 1 reformer × 1 class × 5 days = 21.67 monthly seats", () => {
    const a = buildGoldenAssumptions();
    const cap = calculateCapacity(a);
    expect(cap.weeklyAvailableSeats.toNumber()).toBe(5);
    expect(cap.monthlyAvailableSeats.toNumber()).toBeCloseTo(5 * (52 / 12), 4);
    expect(cap.occupiedSeatsMonthly.toNumber()).toBeCloseTo(5 * (52 / 12), 4);
  });

  it("per-credit price invariant: net × credits = net package", () => {
    const a = buildGoldenAssumptions();
    const p = a.products[0];
    const netPerCredit = productNetRevenuePerCredit(p, a);
    const grossPerCredit = productGrossRevenuePerCredit(p, a);
    const netPackage = productNetPrice(p, a);
    expect(netPerCredit.times(p.creditsIncluded).toFixed(2)).toBe(
      netPackage.toFixed(2)
    );
    expect(grossPerCredit.times(p.creditsIncluded).toNumber()).toBeCloseTo(2000, 0);
    expect(netPerCredit.toNumber()).toBeCloseTo(1695, 0);
  });

  it("drop-in net sales ≈ occupied bookings × service mix × net per booking", () => {
    const a = buildGoldenAssumptions();
    const model = runFinanceModel(a);
    const cap = model.capacity;
    const dropIn = a.products.find((p) => p.id === "drop-in")!;
    const mixPct = (dropIn.serviceDemandPct ?? 100) / 100;
    const netPerCredit = productNetRevenuePerCredit(dropIn, a);
    const expectedDropIn = cap.occupiedSeatsMonthly.times(mixPct).times(netPerCredit);
    expect(model.revenue.dropInRevenue.toNumber()).toBeCloseTo(expectedDropIn.toNumber(), 0);
  });
});

describe("Propagation — controlled assumption changes", () => {
  it("8-pack price change propagates to weighted revenue and P&L, not capacity", () => {
    const base = cloneAssumptions();
    const before = runFinanceModel(base);
    const after = runFinanceModel({
      ...base,
      products: base.products.map((p) =>
        p.id === "8-pack" ? { ...p, price: 15000 } : p
      ),
    });

    expect(after.capacity.monthlyAvailableSeats.toFixed(2)).toBe(
      before.capacity.monthlyAvailableSeats.toFixed(2)
    );
    expect(
      after.revenue.weightedRevenue.weightedNetRevenuePerCredit.gt(
        before.revenue.weightedRevenue.weightedNetRevenuePerCredit
      )
    ).toBe(true);
    expect(after.revenue.netRevenue.gt(before.revenue.netRevenue)).toBe(true);
    expect(after.pl.ebitda.gt(before.pl.ebitda)).toBe(true);
  });

  it("rent change affects EBITDA and break-even, not capacity or pack credits", () => {
    const base = cloneAssumptions();
    const before = runFinanceModel(base);
    const after = runFinanceModel({ ...base, rent: base.rent + 50000 });

    expect(after.capacity.monthlyAvailableSeats.toFixed(2)).toBe(
      before.capacity.monthlyAvailableSeats.toFixed(2)
    );
    expect(after.pl.ebitda.lt(before.pl.ebitda)).toBe(true);
    expect(
      after.breakEven.contributionBreakEven.breakEvenOccupancyPct.gt(
        before.breakEven.contributionBreakEven.breakEvenOccupancyPct
      )
    ).toBe(true);
    expect(before.pl.ebitda.minus(after.pl.ebitda).toFixed(0)).toBe("50000");
  });

  it("reformer count changes capacity and may change break-even occupancy", () => {
    const base = cloneAssumptions();
    const before = runFinanceModel(base);
    const after = runFinanceModel({ ...base, reformers: base.reformers + 1 });

    expect(after.capacity.monthlyAvailableSeats.gt(before.capacity.monthlyAvailableSeats)).toBe(
      true
    );
    expect(after.summary.reformers).toBe(base.reformers + 1);
  });

  it("8-pack validity change affects delivery timing, not net sales per pack", () => {
    const base = cloneAssumptions();
    const eightPack = base.products.find((p) => p.id === "8-pack")!;
    const beforeEcon = analyzeFlexiblePack(eightPack, base);
    const longerValidity = {
      ...eightPack,
      packRules: eightPack.packRules
        ? { ...eightPack.packRules, validityValue: 12 }
        : eightPack.packRules,
    };
    const afterEcon = analyzeFlexiblePack(longerValidity, {
      ...base,
      products: base.products.map((p) => (p.id === "8-pack" ? longerValidity : p)),
    });

    expect(afterEcon.grossPrice.toFixed(2)).toBe(beforeEcon.grossPrice.toFixed(2));
    expect(afterEcon.netPackageValue.toFixed(2)).toBe(beforeEcon.netPackageValue.toFixed(2));
  });

  it("occupancy 60% → 75% propagates through dependent outputs", () => {
    const base = cloneAssumptions();
    const base60 = {
      ...base,
      projectedBookedOccupancyPct: 60,
      projectedAttendedOccupancyPct: 60,
    };
    const base75 = {
      ...base,
      projectedBookedOccupancyPct: 75,
      projectedAttendedOccupancyPct: 75,
    };
    const at60 = runFinanceModel(base60);
    const at75 = runFinanceModel(base75);

    expect(at75.capacity.occupiedSeatsMonthly.gt(at60.capacity.occupiedSeatsMonthly)).toBe(true);
    expect(at75.revenue.netRevenue.gt(at60.revenue.netRevenue)).toBe(true);
    expect(at75.directCosts.totalDirectCosts.gt(at60.directCosts.totalDirectCosts)).toBe(true);
    expect(at75.pl.ebitda.gt(at60.pl.ebitda)).toBe(true);
    expect(at75.pl.netProfit.gt(at60.pl.netProfit)).toBe(true);

    const cash60 =
      at60.cashFlow.monthly.find((m) => m.occupancyPct.gte(58))?.netOperatingCashFlow ??
      at60.cashFlow.monthly.at(-1)!.netOperatingCashFlow;
    const cash75 =
      at75.cashFlow.monthly.find((m) => m.occupancyPct.gte(73))?.netOperatingCashFlow ??
      at75.cashFlow.monthly.at(-1)!.netOperatingCashFlow;
    expect(cash75.gt(cash60)).toBe(true);

    const metrics60 = buildScenarioMetrics(base60, at60);
    const metrics75 = buildScenarioMetrics(base75, at75);
    expect(metrics75.netProfit.gt(metrics60.netProfit)).toBe(true);

    const absoluteTarget = at60.pl.netProfit.plus(100_000).toNumber();
    const gap60 = calculateTargetGap(at60, absoluteTarget);
    const gap75 = calculateTargetGap(at75, absoluteTarget);
    expect(gap60.gap.gt(0)).toBe(true);
    expect(gap75.gap.gt(0)).toBe(true);
    expect(gap75.gap.lt(gap60.gap)).toBe(true);
  });

  it("occupancy sweep 40–80% propagates to occupied seats and revenue", () => {
    const base = cloneAssumptions();
    const levels = [40, 50, 60, 70, 80];
    let prevOccupied = new Decimal(0);
    for (const occ of levels) {
      const model = runFinanceModel({
        ...base,
        projectedBookedOccupancyPct: occ,
        projectedAttendedOccupancyPct: occ,
      });
      expect(model.capacity.occupiedSeatsMonthly.gt(prevOccupied)).toBe(true);
      expect(model.revenue.netRevenue.gt(0)).toBe(true);
      prevOccupied = model.capacity.occupiedSeatsMonthly;
    }
  });

  it("restores baseline after edit cycle", () => {
    const base = cloneAssumptions();
    const baseline = snapshotKeyMetrics(runFinanceModel(base));
    const edited = runFinanceModel({ ...base, rent: 200000 });
    expect(edited.pl.ebitda.toFixed(2)).not.toBe(baseline.ebitda);
    const restored = snapshotKeyMetrics(runFinanceModel(base));
    expect(restored).toEqual(baseline);
  });
});

describe("Cross-page reconciliation", () => {
  it("Home dashboard monthlyRevenue equals P&L net revenue", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.summary.monthlyRevenue.toFixed(2)).toBe(model.pl.netRevenue.toFixed(2));
    expect(model.summary.monthlyRevenue.toFixed(2)).toBe(
      model.revenue.netRevenue.toFixed(2)
    );
  });

  it("gross profit = net revenue − direct costs", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.pl.grossProfit.toFixed(2)).toBe(
      model.pl.netRevenue.minus(model.directCosts.totalDirectCosts).toFixed(2)
    );
  });

  it("EBITDA = gross profit − operating expenses", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.pl.ebitda.toFixed(2)).toBe(
      model.pl.grossProfit.minus(model.pl.operatingExpenses).toFixed(2)
    );
  });
});

describe("Independent cross-check — weighted revenue", () => {
  it("matches hand-calculated service booking mix weighted average", () => {
    const base = cloneAssumptions();
    const tweakedProducts = autoBalanceServiceDemandMix(
      base.products.map((p) => {
        if (p.id === "drop-in") {
          return { ...p, price: 1695, serviceDemandPct: 50, packageMixPct: 50 };
        }
        if (p.id === "8-pack") {
          return { ...p, price: 11525, serviceDemandPct: 50, packageMixPct: 50 };
        }
        if (p.type === "private") return { ...p, serviceDemandPct: 0 };
        return { ...p, serviceDemandPct: 0, packageMixPct: 0 };
      }),
      "drop-in",
      50
    );
    const tweaked = { ...base, products: tweakedProducts };

    const engine = calculateWeightedRealisedRevenue(tweaked);
    const dropInRow = engine.serviceBookingBreakdown.find((r) => r.product.id === "drop-in")!;
    const eightRow = engine.serviceBookingBreakdown.find((r) => r.product.id === "8-pack")!;
    const handGroup = dropInRow.weightedNetSalesImpact.plus(eightRow.weightedNetSalesImpact);
    expect(engine.weightedGroupNetSalesPerOccupiedSpot.toNumber()).toBeCloseTo(
      handGroup.toNumber(),
      0
    );
  });
});

describe("Edge cases", () => {
  it("handles 0% occupancy without NaN", () => {
    const model = runFinanceModel({
      ...cloneAssumptions(),
      projectedBookedOccupancyPct: 0,
    });
    expect(model.revenue.netRevenue.isFinite()).toBe(true);
    expect(model.pl.ebitda.isFinite()).toBe(true);
  });

  it("rejects occupancy > 100% via validateAssumptions", () => {
    const base = cloneAssumptions();
    const errors = validateAssumptions({
      ...base,
      projectedBookedOccupancyPct: 110,
    });
    expect(errors.some((e) => e.field === "projectedBookedOccupancyPct")).toBe(true);
  });

  it("booked vs attended occupancy are distinct inputs", () => {
    const base = cloneAssumptions();
    const model = runFinanceModel({
      ...base,
      projectedBookedOccupancyPct: 80,
      projectedAttendedOccupancyPct: 60,
    });
    expect(model.capacity.occupiedSeatsMonthly.gt(model.capacity.attendedSeatsMonthly)).toBe(
      true
    );
  });
});

describe("Cash basis labelling", () => {
  it("documents prepaid purchase timing for operating inflows", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.cashFlow.inflowBasis).toBe("prepaid_pack_purchase_cash");
  });

  it("scenario gross billings at steady occupancy equals model gross customer billings", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const metrics = buildScenarioMetrics(createSampleAssumptions(), model);
    expect(metrics.grossBillingsEarnedTiming.toFixed(2)).toBe(
      model.revenue.grossCustomerBillings.toFixed(2)
    );
    expect(metrics.earnedNetRevenue.toFixed(2)).toBe(model.revenue.netRevenue.toFixed(2));
  });
  it("capex change propagates to launch investment and payback hurdle", () => {
    const base = cloneAssumptions();
    const before = runFinanceModel(base);
    const after = runFinanceModel({
      ...base,
      capexReformers: base.capexReformers + 500000,
      workingCapital: base.workingCapital + 100000,
    });

    expect(after.summary.launchInvestment.gt(before.summary.launchInvestment)).toBe(true);
    expect(after.payback.initialInvestment.gt(before.payback.initialInvestment)).toBe(true);
    expect(
      after.summary.launchInvestment.minus(before.summary.launchInvestment).toNumber()
    ).toBe(600000);
  });
});

describe("Payback — cumulative cash flow basis", () => {
  it("uses cumulativeFreeCashFlow series, not profit/investment ratio", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const paybackMonth = model.payback.paybackMonth;
    if (paybackMonth !== null) {
      const point = model.cashFlow.monthly.find((m) => m.month === paybackMonth);
      expect(point!.recoveryPosition.gte(0)).toBe(true);
      const prior = model.cashFlow.monthly.find((m) => m.month === paybackMonth - 1);
      if (prior) {
        expect(prior.recoveryPosition.lt(0)).toBe(true);
      }
    }
  });
});
