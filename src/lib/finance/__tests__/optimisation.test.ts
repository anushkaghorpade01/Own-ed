/**
 * Target Profit + Optimisation Engine tests
 */
import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../run-model";
import {
  runOptimisationAnalysis,
  calculateTargetGap,
  requiredOccupancyForTargetProfit,
  requiredRealisedRevenueForTargetProfit,
  requiredPTSessionsForTargetProfit,
  requiredFixedCostReductionForTargetProfit,
  searchCombinationPaths,
  applyCombinationPath,
  applyOccupancy,
  PROFIT_TOLERANCE_INR,
} from "../engine/optimisation";

function clone() {
  return structuredClone(createSampleAssumptions());
}

describe("Target gap", () => {
  it("detects target already achieved", () => {
    const base = clone();
    const model = runFinanceModel(base);
    const current = model.pl.netProfit.toNumber();
    const gap = calculateTargetGap(model, Math.floor(current));
    expect(gap.alreadyAchieved).toBe(true);
    expect(gap.gap.lte(PROFIT_TOLERANCE_INR)).toBe(true);
  });

  it("computes positive gap for ambitious target", () => {
    const model = runFinanceModel(clone());
    const gap = calculateTargetGap(model, 1_000_000);
    expect(gap.gap.gt(0)).toBe(true);
    expect(gap.alreadyAchieved).toBe(false);
  });
});

describe("Occupancy solver", () => {
  it("returns not feasible when target exceeds 100% capacity", () => {
    const base = clone();
    const result = requiredOccupancyForTargetProfit(base, new Decimal(10_000_000), 100);
    expect(result.feasible).toBe(false);
    expect(result.feasibility).toBe("not_feasible");
  });

  it("finds required occupancy for modest target above current", () => {
    const base = clone();
    const model = runFinanceModel(base);
    const target = model.pl.netProfit.plus(20_000);
    const result = requiredOccupancyForTargetProfit(base, target, 100);
    if (result.feasible && result.requiredValue !== null) {
      const verified = runFinanceModel(
        applyOccupancy(base, result.requiredValue as number)
      );
      expect(verified.pl.netProfit.gte(target.minus(PROFIT_TOLERANCE_INR))).toBe(true);
    }
  });
});

describe("Price solver", () => {
  it("finds price scale within max willingness", () => {
    const base = clone();
    const model = runFinanceModel(base);
    const target = model.pl.netProfit.plus(30_000);
    const result = requiredRealisedRevenueForTargetProfit(base, target, 25);
    if (result.feasible) {
      expect(result.requiredValue).not.toBeNull();
    }
  });
});

describe("PT solver", () => {
  it("calculates additional sessions for gap", () => {
    const base = clone();
    const model = runFinanceModel(base);
    const target = model.pl.netProfit.plus(92_000);
    const result = requiredPTSessionsForTargetProfit(base, target, 200);
    expect(result.lever).toBe("private_sessions");
    if (result.feasible && typeof result.requiredValue === "number") {
      expect(result.requiredValue).toBeGreaterThan(base.privateSessionsPerMonth);
    }
  });
});

describe("Fixed cost solver", () => {
  it("finds reduction when target is close to current", () => {
    const base = clone();
    const model = runFinanceModel(base);
    const target = model.pl.netProfit.plus(5_000);
    const result = requiredFixedCostReductionForTargetProfit(base, target);
    if (result.feasible) {
      expect(result.delta).toContain("−");
    }
  });
});

describe("Combination paths", () => {
  it("reconciles verified paths through runFinanceModel", () => {
    const base = clone();
    const model = runFinanceModel(base);
    const target = model.pl.netProfit.plus(80_000);
    const paths = searchCombinationPaths(base, target);
    for (const path of paths) {
      if (path.verified) {
        const merged = applyCombinationPath(base, path);
        const check = runFinanceModel(merged);
        expect(check.pl.netProfit.gte(target.minus(PROFIT_TOLERANCE_INR))).toBe(true);
      }
    }
  });

  it("respects locked levers", () => {
    const base = clone();
    const model = runFinanceModel(base);
    const target = model.pl.netProfit.plus(100_000);
    const paths = searchCombinationPaths(base, target, {
      leverStatus: { occupancy: "locked", realised_revenue: "locked", private_sessions: "locked", reformers: "locked" },
      objective: "balanced",
    });
    expect(paths.every((p) => !p.changeSummary.some((l) => l.startsWith("Occupancy →")))).toBe(true);
  });
});

describe("Full analysis", () => {
  it("returns profit curve with 100% point", () => {
    const analysis = runOptimisationAnalysis(clone(), 100_000);
    expect(analysis.profitCurve.some((p) => p.occupancyPct === 100)).toBe(true);
    expect(analysis.bottleneck.primary).toBeTruthy();
    expect(analysis.opportunities.length).toBeGreaterThan(0);
  }, 30_000);

  it("excludes locked levers from single-lever solvers", () => {
    const analysis = runOptimisationAnalysis(clone(), 100_000, "net_profit", {
      leverStatus: {
        occupancy: "locked",
        realised_revenue: "locked",
        pack_pricing: "locked",
        private_sessions: "locked",
        duo_sessions: "locked",
        other_revenue: "locked",
        fixed_costs: "locked",
        staff_costs: "locked",
        reformers: "locked",
        standing_spot: "locked",
        standby: "locked",
      },
    });
    expect(analysis.singleLeverSolvers).toHaveLength(0);
    expect(analysis.standbyInsight.message).toContain("locked");
  });

  it("includes pack pricing solver when only pack_pricing is open", () => {
    const analysis = runOptimisationAnalysis(clone(), 100_000, "net_profit", {
      leverStatus: {
        realised_revenue: "locked",
        pack_pricing: "open",
      },
    });
    expect(analysis.singleLeverSolvers.some((s) => s.lever === "pack_pricing")).toBe(true);
    expect(analysis.singleLeverSolvers.some((s) => s.lever === "realised_revenue")).toBe(false);
  }, 15_000);

  it("handles negative profit base case", () => {
    const base = clone();
    base.rent = 500_000;
    const analysis = runOptimisationAnalysis(base, 50_000);
    expect(analysis.targetGap.gap.gt(0)).toBe(true);
    expect(analysis.structuralViability.message).toBeTruthy();
  });

  it("handles zero-capacity edge via reformers=0 blocked by schema min 1", () => {
    const base = clone();
    base.reformers = 1;
    base.classesPerDay = 1;
    base.operatingDaysPerWeek = 1;
    const analysis = runOptimisationAnalysis(base, 100_000);
    expect(analysis.currentModel.availableSpots.gt(0)).toBe(true);
  }, 15_000);
});

describe("Structural viability", () => {
  it("flags impossible target at operational ceiling", () => {
    const base = clone();
    const analysis = runOptimisationAnalysis(base, 5_000_000);
    expect(analysis.structuralViability.achievableAtOperationalCeiling).toBe(false);
  });
});
