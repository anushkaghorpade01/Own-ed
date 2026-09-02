import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../run-model";
import {
  calculateServiceDemandMixTotal,
  autoBalanceServiceDemandMix,
  splitServiceDemandSpots,
  canRemoveFromServiceDemandMix,
  createServiceMixCreditPack,
  normalizeServiceDemandMixTo100,
} from "../engine/service-demand-mix";
import { analyzePrivateEconomics } from "../engine/private-economics";

function clone() {
  return structuredClone(createSampleAssumptions());
}

describe("Service demand mix", () => {
  it("active base case products sum to 100%", () => {
    const mix = calculateServiceDemandMixTotal(createSampleAssumptions());
    expect(mix.valid).toBe(true);
    expect(mix.total.toNumber()).toBe(100);
    expect(mix.products.length).toBe(4);
  });

  it("private share increase shifts spots without changing class count", () => {
    const base = clone();
    const before = runFinanceModel(base);
    const privateProduct = base.products.find((p) => p.type === "private")!;
    const dropIn = base.products.find((p) => p.id === "drop-in")!;

    const afterProducts = autoBalanceServiceDemandMix(
      base.products.map((p) => {
        if (p.id === "private-session") return { ...p, serviceDemandPct: 20, packageMixPct: 0 };
        if (p.id === "drop-in") return { ...p, serviceDemandPct: 5 };
        return p;
      }),
      "private-session",
      20
    );

    const after = runFinanceModel({ ...base, products: afterProducts });

    expect(after.capacity.weeklyClasses.toFixed(2)).toBe(before.capacity.weeklyClasses.toFixed(2));
    expect(after.revenue.privateRevenue.gt(before.revenue.privateRevenue)).toBe(true);
  });

  it("split keeps total spots at occupancy", () => {
    const base = clone();
    const model = runFinanceModel(base);
    const split = splitServiceDemandSpots(base, model.capacity.occupiedSeatsMonthly);
    expect(split.groupSpots.plus(split.privateSpots).toFixed(2)).toBe(
      model.capacity.occupiedSeatsMonthly.toFixed(2)
    );
  });
});

describe("Service demand mix add/remove", () => {
  it("protects canonical core products from removal", () => {
    const base = createSampleAssumptions();
    expect(canRemoveFromServiceDemandMix(base.products.find((p) => p.id === "drop-in")!, base)).toBe(
      false
    );
    expect(canRemoveFromServiceDemandMix(base.products.find((p) => p.id === "private-session")!, base)).toBe(
      false
    );
  });

  it("allows removing extra credit packs", () => {
    const base = createSampleAssumptions();
    const extra = createServiceMixCreditPack(3);
    const assumptions = {
      ...base,
      products: [...base.products, extra],
    };
    expect(canRemoveFromServiceDemandMix(extra, assumptions)).toBe(true);
    const after = normalizeServiceDemandMixTo100(
      assumptions.products.filter((p) => p.id !== extra.id)
    );
    expect(calculateServiceDemandMixTotal({ ...base, products: after }).valid).toBe(true);
  });
});

describe("Private economics", () => {
  it("price increase raises contribution without changing capacity", () => {
    const base = clone();
    const before = runFinanceModel(base);
    const privateP = base.products.find((p) => p.type === "private")!;
    const after = runFinanceModel({
      ...base,
      products: base.products.map((p) =>
        p.id === privateP.id ? { ...p, price: 5000 } : p
      ),
      privatePrice: 5000,
    });

    expect(after.capacity.monthlyAvailableSeats.toFixed(2)).toBe(
      before.capacity.monthlyAvailableSeats.toFixed(2)
    );
    expect(after.revenue.privateRevenue.gt(before.revenue.privateRevenue)).toBe(true);
    expect(analyzePrivateEconomics({ ...base, products: base.products.map((p) => p.id === privateP.id ? { ...p, price: 5000 } : p) }).contributionPerSession.gt(
      analyzePrivateEconomics(base).contributionPerSession
    )).toBe(true);
  });

  it("exclusive studio raises economic price floor via opportunity cost", () => {
    const base = clone();
    const partial = analyzePrivateEconomics(base, "standard");
    const exclusive = analyzePrivateEconomics(
      { ...base, privateRequiresExclusiveStudio: true },
      "standard"
    );
    expect(exclusive.economicPriceFloor.gt(partial.economicPriceFloor)).toBe(true);
    expect(exclusive.alternativeGroupContribution.gt(partial.alternativeGroupContribution)).toBe(
      true
    );
  });
});
