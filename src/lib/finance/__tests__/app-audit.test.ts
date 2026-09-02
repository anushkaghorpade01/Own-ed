/**
 * App-wide audit — navigation integrity, input propagation backtests,
 * and cross-module math reconciliation.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../run-model";
import { calculateCapacity } from "../engine/capacity";
import { stripGst, getEffectiveGstModeForAssumptions } from "../engine/product-pricing";
import { d } from "../decimal";
import { runOptimisationAnalysis, applyCombinationPath, PROFIT_TOLERANCE_INR } from "../engine/optimisation";
import {
  evaluateSalesPlan,
  solveSalesForProfitTarget,
} from "../engine/sales-client-target";
import { MATH_REVIEW_AREAS } from "../math-review-areas";
import type { FinanceAssumptions, ClassScheduleEntry } from "../schemas";

const APP_ROOT = join(__dirname, "../../../app");

/** Nav hrefs that must resolve to a page.tsx (or redirect) under src/app */
const MATH_NAV_HREFS = [
  "/math",
  "/math/scenarios",
  "/math/sales-target",
  "/math/optimise",
  "/math/assumptions",
  "/math/capacity",
  "/math/access-products",
  "/math/pricing",
  "/math/unit-economics",
  "/math/pl",
  "/math/cash-flow",
  "/math/break-even",
  "/math/payback",
  "/math/dictionary",
  "/math/review",
  "/math/actuals",
  "/math/snapshots",
];

const MAIN_NAV_HREFS = [
  "/",
  "/math",
  "/space",
  "/studios",
  "/programming",
  "/product",
  "/brand",
  "/roadmap",
  "/library",
  "/guide",
];

const ACCESS_PRODUCT_SUBPAGES = [
  "/math/access-products/mix",
  "/math/access-products/flexible",
  "/math/access-products/pack-designer",
  "/math/access-products/standing",
  "/math/access-products/standby",
  "/math/access-products/credit-health",
  "/math/access-products/actuals",
];

function hrefToPagePath(href: string): string {
  if (href === "/") return join(APP_ROOT, "page.tsx");
  const segments = href.replace(/^\//, "").split("/");
  return join(APP_ROOT, ...segments, "page.tsx");
}

function clone(): FinanceAssumptions {
  return structuredClone(createSampleAssumptions());
}

describe("Navigation — all linked routes exist", () => {
  for (const href of [...MATH_NAV_HREFS, ...MAIN_NAV_HREFS, ...ACCESS_PRODUCT_SUBPAGES]) {
    it(`page exists for ${href}`, () => {
      expect(existsSync(hrefToPagePath(href))).toBe(true);
    });
  }

  it("math review areas point to existing pages", () => {
    for (const area of MATH_REVIEW_AREAS) {
      expect(existsSync(hrefToPagePath(area.href))).toBe(true);
    }
  });

  it("schedule redirects to capacity (removed from nav)", () => {
    expect(existsSync(hrefToPagePath("/math/schedule"))).toBe(true);
    expect(MATH_NAV_HREFS.includes("/math/schedule")).toBe(false);
  });
});

describe("Backtest — duo revenue uses duoSessionsPerMonth", () => {
  it("duo revenue scales linearly with session count", () => {
    const base = clone();
    base.otherRevenuePerMonth = 0;
    base.workshopCountPerMonth = 0;
    base.privateSessionsPerMonth = 0;
    base.projectedBookedOccupancyPct = 50;

    const at10 = runFinanceModel({ ...base, duoSessionsPerMonth: 10 });
    const at20 = runFinanceModel({ ...base, duoSessionsPerMonth: 20 });

    const mode = getEffectiveGstModeForAssumptions(base);
    const netPerSession = stripGst(d(base.duoPricePerPerson), base.gstRatePct, mode).net.times(
      base.duoAvgPeople
    );

    expect(at10.revenue.duoRevenue.toNumber()).toBeCloseTo(netPerSession.times(10).toNumber(), 0);
    expect(at20.revenue.duoRevenue.toNumber()).toBeCloseTo(netPerSession.times(20).toNumber(), 0);
    expect(at20.revenue.duoRevenue.toNumber()).toBeCloseTo(
      at10.revenue.duoRevenue.times(2).toNumber(),
      0
    );
    expect(at20.pl.netProfit.gt(at10.pl.netProfit)).toBe(true);
  });
});

describe("Backtest — schedule-driven capacity (engine only)", () => {
  it("useScheduleForCapacity overrides classesPerDay capacity", () => {
    const base = clone();
    const entry: ClassScheduleEntry = {
      id: "test-mon",
      day: "mon",
      startTime: "07:00",
      durationMinutes: 50,
      classType: "Reformer",
      capacity: 8,
      peakOffPeak: "neutral",
      instructor: "",
      minAttendance: 0,
      recurring: true,
      status: "active",
    };

    const withSchedule = {
      ...base,
      useScheduleForCapacity: true,
      schedule: [entry],
      classesPerDay: 99,
      reformers: 99,
    };

    const cap = calculateCapacity(withSchedule);
    expect(cap.weeklyAvailableSeats.toNumber()).toBe(8);
    expect(cap.weeklyClasses.toNumber()).toBe(1);
  });
});

describe("Backtest — end-to-end input propagation", () => {
  it("price → revenue → EBITDA → net profit chain is monotonic", () => {
    const base = clone();
    const prices = [0.9, 1.0, 1.1].map((scale) => {
      const assumptions = {
        ...base,
        products: base.products.map((p) =>
          p.type === "credit_pack" || p.type === "drop_in"
            ? { ...p, price: Math.round(p.price * scale) }
            : p
        ),
      };
      return runFinanceModel(assumptions).pl.netProfit.toNumber();
    });
    expect(prices[1]).toBeGreaterThan(prices[0]);
    expect(prices[2]).toBeGreaterThan(prices[1]);
  });

  it("reformer count propagates to sales target delivery capacity", () => {
    const base = clone();
    const quantities = solveSalesForProfitTarget(base, 80_000, "balanced", 1);
    const small = evaluateSalesPlan({ ...base, reformers: 3 }, quantities, 1);
    const large = evaluateSalesPlan({ ...base, reformers: 6 }, quantities, 1);
    expect(large.delivery.availableReformerSpots.gt(small.delivery.availableReformerSpots)).toBe(
      true
    );
  });

  it("custom sales mix evaluates profit through canonical engine", () => {
    const base = clone();
    const quantities = solveSalesForProfitTarget(base, 80_000, "balanced", 1);
    const evaluated = evaluateSalesPlan(base, quantities, 1);
    expect(evaluated.planningNetProfit.isFinite()).toBe(true);
    expect(evaluated.delivery.capacityStatus).toBeTruthy();
  });
});

describe("Backtest — optimisation paths verify through runFinanceModel", () => {
  it(
    "verified combination paths hit target within tolerance",
    () => {
      const base = clone();
      const model = runFinanceModel(base);
      const target = model.pl.netProfit.plus(30_000).toNumber();
      const analysis = runOptimisationAnalysis(base, target);

      expect(analysis.combinationPaths.length).toBeGreaterThan(0);
      const verified = analysis.combinationPaths.filter((p) => p.verified);
      expect(verified.length).toBeGreaterThan(0);

      for (const path of verified.slice(0, 3)) {
        const merged = applyCombinationPath(base, path);
        const check = runFinanceModel(merged);
        expect(
          check.pl.netProfit.gte(new Decimal(target).minus(PROFIT_TOLERANCE_INR))
        ).toBe(true);
      }
    },
    15_000
  );
});

describe("Backtest — P&L identity invariants hold under perturbation", () => {
  const perturbations: Array<(a: FinanceAssumptions) => FinanceAssumptions> = [
    (a) => ({ ...a, rent: a.rent + 25_000 }),
    (a) => ({ ...a, projectedBookedOccupancyPct: 72 }),
    (a) => ({ ...a, duoSessionsPerMonth: a.duoSessionsPerMonth + 8 }),
    (a) => ({ ...a, otherRevenuePerMonth: a.otherRevenuePerMonth + 15_000 }),
  ];

  for (const [i, mutate] of perturbations.entries()) {
    it(`perturbation ${i + 1} preserves accounting identities`, () => {
      const model = runFinanceModel(mutate(clone()));
      expect(model.pl.grossProfit.toFixed(2)).toBe(
        model.pl.netRevenue.minus(model.directCosts.totalDirectCosts).toFixed(2)
      );
      expect(model.pl.ebitda.toFixed(2)).toBe(
        model.pl.grossProfit.minus(model.pl.operatingExpenses).toFixed(2)
      );
      expect(model.pl.netProfit.toFixed(2)).toBe(
        model.pl.profitBeforeTax.minus(model.pl.incomeTax).toFixed(2)
      );
      expect(model.summary.monthlyRevenue.toFixed(2)).toBe(model.revenue.netRevenue.toFixed(2));
    });
  }
});
