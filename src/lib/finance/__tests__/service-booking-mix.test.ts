import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../run-model";
import {
  autoBalanceServiceDemandMix,
  calculateServiceDemandMixTotal,
  listBaseCaseMixProducts,
} from "../engine/service-demand-mix";
import {
  allocateOccupiedBookingsByServiceDemand,
  calculateServiceBookingEconomics,
} from "../engine/service-booking-economics";
import { analyzePrivateEconomics } from "../engine/private-economics";

function clone() {
  return structuredClone(createSampleAssumptions());
}

function setPrivateMix(base: ReturnType<typeof clone>, privatePct: number) {
  const privateProduct = base.products.find((p) => p.type === "private")!;
  const dropIn = base.products.find((p) => p.id === "drop-in")!;
  const dropInNew = Math.max(0, (dropIn.serviceDemandPct ?? 10) - (privatePct - 15));
  return autoBalanceServiceDemandMix(
    base.products.map((p) => {
      if (p.id === "private-session") return { ...p, serviceDemandPct: privatePct };
      if (p.id === "drop-in") return { ...p, serviceDemandPct: dropInNew };
      return p;
    }),
    "private-session",
    privatePct
  );
}

describe("Service booking mix — Private in core model", () => {
  it("lists four base-case services including Private", () => {
    const products = listBaseCaseMixProducts(createSampleAssumptions());
    expect(products.map((p) => p.type)).toEqual(
      expect.arrayContaining(["drop_in", "credit_pack", "private"])
    );
    expect(products.length).toBe(4);
  });

  it("allocates occupied bookings to sum to total", () => {
    const base = clone();
    base.projectedBookedOccupancyPct = 75;
    const model = runFinanceModel(base);
    const total = model.capacity.occupiedSeatsMonthly;
    const alloc = allocateOccupiedBookingsByServiceDemand(base, total);
    const sumSpots = alloc.reduce((s, a) => s + a.occupiedBookings.toNumber(), 0);
    expect(sumSpots).toBeCloseTo(total.toNumber(), 1);
  });

  it("dynamic dependency: Private mix increases private revenue and blended metrics", () => {
    const base = clone();
    base.projectedBookedOccupancyPct = 75;
    const zeroPrivateProducts = setPrivateMix(base, 0);
    const zeroPrivate = runFinanceModel({ ...base, products: zeroPrivateProducts });

    const withPrivateProducts = setPrivateMix(base, 15);
    const withPrivate = runFinanceModel({ ...base, products: withPrivateProducts });

    expect(withPrivate.revenue.privateRevenue.gt(zeroPrivate.revenue.privateRevenue)).toBe(true);
    expect(withPrivate.revenue.netRevenue.gt(zeroPrivate.revenue.netRevenue)).toBe(true);
    expect(
      withPrivate.revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot.gt(
        zeroPrivate.revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot
      )
    ).toBe(true);
    expect(withPrivate.pl.netProfit.gt(zeroPrivate.pl.netProfit)).toBe(true);
    expect(
      withPrivate.breakEven.contributionBreakEven.breakEvenOccupancyPct.lt(
        zeroPrivate.breakEven.contributionBreakEven.breakEvenOccupancyPct
      )
    ).toBe(true);
  });

  it("private price change updates revenue and profit but not net sales from group SKUs", () => {
    const base = clone();
    const before = runFinanceModel(base);
    const after = runFinanceModel({
      ...base,
      products: base.products.map((p) =>
        p.id === "private-session" ? { ...p, price: 5000 } : p
      ),
      privatePrice: 5000,
    });
    expect(after.revenue.privateRevenue.gt(before.revenue.privateRevenue)).toBe(true);
    expect(after.revenue.groupClassRevenue.toNumber()).toBeCloseTo(
      before.revenue.groupClassRevenue.toNumber(),
      0
    );
    expect(after.pl.netProfit.gt(before.pl.netProfit)).toBe(true);
  });

  it("private instructor cost changes contribution not net sales", () => {
    const base = clone();
    const before = runFinanceModel(base);
    const privateP = base.products.find((p) => p.type === "private")!;
    const afterProducts = base.products.map((p) =>
      p.id === privateP.id
        ? {
            ...p,
            privateRules: {
              ...p.privateRules!,
              instructorCostPerHour: 1200,
            },
          }
        : p
    );
    const after = runFinanceModel({ ...base, products: afterProducts });
    expect(after.revenue.netRevenue.toNumber()).toBeCloseTo(before.revenue.netRevenue.toNumber(), 0);
    expect(
      after.revenue.weightedRevenue.blendedContributionPerOccupiedSpot.lt(
        before.revenue.weightedRevenue.blendedContributionPerOccupiedSpot
      )
    ).toBe(true);
    expect(after.pl.netProfit.lt(before.pl.netProfit)).toBe(true);
  });

  it("blended net sales includes Private at 15% × ₹4,000 = ₹600 weighted", () => {
    const base = clone();
    const economics = calculateServiceBookingEconomics(base);
    const privateRow = economics.rows.find((r) => r.product.type === "private")!;
    expect(privateRow.serviceBookingMixPct.toNumber()).toBe(15);
    expect(privateRow.netSalesPerOccupiedBooking.toNumber()).toBe(4000);
    expect(privateRow.weightedNetSalesImpact.toNumber()).toBeCloseTo(600, 0);
    expect(economics.blendedNetSalesPerOccupiedSpot.toNumber()).toBeGreaterThan(
      economics.weightedGroupNetSalesPerOccupiedSpot.toNumber()
    );
  });

  it("service mix totals 100%", () => {
    const mix = calculateServiceDemandMixTotal(createSampleAssumptions());
    expect(mix.valid).toBe(true);
    expect(mix.total.toNumber()).toBe(100);
  });
});
