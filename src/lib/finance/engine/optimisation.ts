/**
 * Target Profit + Optimisation Engine
 *
 * All profit evaluation uses runFinanceModel() — no duplicate formulas.
 */
import Decimal from "decimal.js";
import { d } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import { runFinanceModel, type FinanceModelOutput } from "../run-model";
import { ENGINE_VERSION, FORMULA_VERSION } from "./scenarios";
import { stripGst, getEffectiveGstModeForAssumptions } from "./revenue";
import { privateContributionPerSession } from "./private-economics";
import { totalStandingSpotCommittedSeatsMonthly } from "./standing-spots";

export const OPTIMISATION_ENGINE_VERSION = "1.0.0";
export const OPTIMISATION_FORMULA_VERSION = "2026-09-01";
export const PROFIT_TOLERANCE_INR = 500;

export type TargetMetric = "net_profit" | "ebitda" | "operating_cash";
export type LeverId =
  | "occupancy"
  | "realised_revenue"
  | "pack_pricing"
  | "classes_per_day"
  | "reformers"
  | "fixed_costs"
  | "staff_costs"
  | "private_sessions"
  | "duo_sessions"
  | "other_revenue"
  | "standing_spot"
  | "standby";

export type LeverStatus = "open" | "prefer_not" | "locked";
export type OptimisationObjective =
  | "balanced"
  | "minimise_price"
  | "minimise_occupancy"
  | "minimise_capex"
  | "minimise_complexity"
  | "fastest_payback"
  | "maximise_profit";

export type FeasibilityLabel = "healthy" | "stretch" | "high_risk" | "not_feasible";
export type BottleneckType =
  | "demand"
  | "pricing"
  | "capacity"
  | "fixed_costs"
  | "product_mix"
  | "schedule"
  | "capex_burden"
  | "low_margin_services"
  | "peak_concentration";

export interface OptimisationPreferences {
  leverStatus?: Partial<Record<LeverId, LeverStatus>>;
  objective?: OptimisationObjective;
  /** Operational occupancy ceiling (default 90%) */
  operationalOccupancyCeiling?: number;
  /** Max price increase willingness (default 20%) */
  maxPriceIncreasePct?: number;
}

export interface OptimisationAuditRecord {
  target: number;
  targetMetric: TargetMetric;
  baseAssumptionsId: string;
  changedAssumptions: Partial<FinanceAssumptions>;
  resultNetProfit: number;
  resultEbitda: number;
  verified: boolean;
  engineVersion: string;
  formulaVersion: string;
  optimisationVersion: string;
  generatedAt: string;
}

export interface TargetGap {
  target: Decimal;
  current: Decimal;
  gap: Decimal;
  alreadyAchieved: boolean;
  metric: TargetMetric;
}

export interface SingleLeverSolverResult {
  lever: LeverId;
  label: string;
  currentValue: number | string;
  requiredValue: number | string | null;
  delta: string | null;
  projectedNetProfit: Decimal | null;
  feasible: boolean;
  feasibility: FeasibilityLabel;
  message: string;
  confidence: "high" | "medium" | "low";
}

export interface CombinationPath {
  id: string;
  name: string;
  changes: Partial<FinanceAssumptions>;
  changeSummary: string[];
  projectedNetProfit: Decimal;
  projectedEbitda: Decimal;
  paybackMonth: number | null;
  capexRequired: Decimal;
  feasibility: FeasibilityLabel;
  operationalRisk: string;
  verified: boolean;
  audit: OptimisationAuditRecord;
}

export interface ProfitCurvePoint {
  occupancyPct: number;
  netRevenue: Decimal;
  contribution: Decimal;
  ebitda: Decimal;
  netProfit: Decimal;
}

export interface CostOptimisationRow {
  key: string;
  label: string;
  current: Decimal;
  category: "structurally_fixed" | "semi_controllable" | "controllable" | "do_not_cut";
  impactAt5Pct: Decimal;
  impactAt10Pct: Decimal;
  impactAt15Pct: Decimal;
}

export interface OptimisationOpportunity {
  rank: number;
  lever: LeverId;
  title: string;
  potentialImpact: Decimal;
  difficulty: "low" | "medium" | "high";
  capex: Decimal;
  risk: FeasibilityLabel;
  confidence: "high" | "medium" | "low";
  summary: string;
}

export interface OptimisationAnalysis {
  targetGap: TargetGap;
  currentModel: {
    netProfit: Decimal;
    ebitda: Decimal;
    operatingCash: Decimal;
    paybackMonth: number | null;
    occupancyPct: number;
    realisedRevenuePerSpot: Decimal;
    availableSpots: Decimal;
    occupiedSpots: Decimal;
  };
  structuralViability: {
    achievableAtOperationalCeiling: boolean;
    maxNetProfitAt90Pct: Decimal;
    maxNetProfitAt100Pct: Decimal;
    message: string | null;
  };
  singleLeverSolvers: SingleLeverSolverResult[];
  combinationPaths: CombinationPath[];
  opportunities: OptimisationOpportunity[];
  bottleneck: {
    primary: BottleneckType;
    summary: string;
    supporting: BottleneckType[];
  };
  profitCurve: ProfitCurvePoint[];
  costOptimisation: CostOptimisationRow[];
  standbyInsight: {
    maxIncrementalContribution: Decimal;
    canCloseGapAlone: boolean;
    message: string;
  };
  generatedAt: string;
}

const DEFAULT_PREFS: Required<OptimisationPreferences> = {
  leverStatus: {},
  objective: "balanced",
  operationalOccupancyCeiling: 90,
  maxPriceIncreasePct: 20,
};

function isLeverOpen(prefs: OptimisationPreferences, lever: LeverId): boolean {
  const status = prefs.leverStatus?.[lever] ?? "open";
  return status !== "locked";
}

function isLeverPreferred(prefs: OptimisationPreferences, lever: LeverId): boolean {
  return (prefs.leverStatus?.[lever] ?? "open") === "prefer_not";
}

/** Include in ranked opportunities — open and not deprioritised */
function isLeverPreferredForOpportunities(
  prefs: OptimisationPreferences,
  lever: LeverId
): boolean {
  return isLeverOpen(prefs, lever) && !isLeverPreferred(prefs, lever);
}

type PricingMode = "all_flexible" | "pack_only" | "none";

function resolvePricingMode(prefs: OptimisationPreferences): PricingMode {
  const allOpen =
    isLeverOpen(prefs, "realised_revenue") &&
    !isLeverPreferred(prefs, "realised_revenue");
  const packOpen =
    isLeverOpen(prefs, "pack_pricing") && !isLeverPreferred(prefs, "pack_pricing");
  if (allOpen) return "all_flexible";
  if (packOpen) return "pack_only";
  if (isLeverOpen(prefs, "realised_revenue")) return "all_flexible";
  if (isLeverOpen(prefs, "pack_pricing")) return "pack_only";
  return "none";
}

function applyPricingMode(
  assumptions: FinanceAssumptions,
  mode: PricingMode,
  scale: number
): FinanceAssumptions {
  if (mode === "all_flexible") return applyPriceScale(assumptions, scale);
  if (mode === "pack_only") return applyPackPriceScale(assumptions, scale);
  return assumptions;
}

export const LEVER_STATUS_HELP: Record<LeverStatus, string> = {
  open: "Optimise may adjust this lever in recommended paths.",
  prefer_not: "Available, but only if other open levers cannot close the gap.",
  locked: "Held fixed — excluded from all path and solver calculations.",
};

export function describeLeverStatusChange(
  leverLabel: string,
  status: LeverStatus
): string {
  switch (status) {
    case "locked":
      return `${leverLabel} is now locked. It will stay fixed in all recommended paths.`;
    case "prefer_not":
      return `${leverLabel} is set to prefer not. Optimise will try other levers first.`;
    default:
      return `${leverLabel} is now open. Optimise may suggest changes here.`;
  }
}

export function getTargetMetricValue(
  model: FinanceModelOutput,
  metric: TargetMetric
): Decimal {
  switch (metric) {
    case "net_profit":
      return model.pl.netProfit;
    case "ebitda":
      return model.pl.ebitda;
    case "operating_cash":
      return model.cashFlow.monthly[2]?.netOperatingCashFlow ??
        model.cashFlow.monthly[0]?.netOperatingCashFlow ??
        new Decimal(0);
  }
}

export function calculateTargetGap(
  model: FinanceModelOutput,
  target: number,
  metric: TargetMetric = "net_profit"
): TargetGap {
  const current = getTargetMetricValue(model, metric);
  const targetD = d(target);
  return {
    target: targetD,
    current,
    gap: targetD.minus(current),
    alreadyAchieved: current.gte(targetD.minus(PROFIT_TOLERANCE_INR)),
    metric,
  };
}

function applyOccupancy(
  assumptions: FinanceAssumptions,
  occupancyPct: number
): FinanceAssumptions {
  const occ = Math.min(100, Math.max(0, occupancyPct));
  return {
    ...assumptions,
    projectedBookedOccupancyPct: occ,
    projectedAttendedOccupancyPct: Math.min(
      occ,
      assumptions.projectedAttendedOccupancyPct > occ
        ? occ
        : assumptions.projectedAttendedOccupancyPct
    ),
  };
}

function applyPriceScale(
  assumptions: FinanceAssumptions,
  scale: number
): FinanceAssumptions {
  return {
    ...assumptions,
    products: assumptions.products.map((p) => {
      if (p.type !== "credit_pack" && p.type !== "drop_in") return p;
      return { ...p, price: Math.round(p.price * scale * 100) / 100 };
    }),
  };
}

/** Credit packs only — distinct from drop-in / blended realised revenue lever */
function applyPackPriceScale(
  assumptions: FinanceAssumptions,
  scale: number
): FinanceAssumptions {
  return {
    ...assumptions,
    products: assumptions.products.map((p) => {
      if (p.type !== "credit_pack") return p;
      return { ...p, price: Math.round(p.price * scale * 100) / 100 };
    }),
  };
}

function applyStaffCostScale(
  assumptions: FinanceAssumptions,
  scale: number
): FinanceAssumptions {
  const s = Math.max(0.5, Math.min(1, scale));
  return {
    ...assumptions,
    additionalInstructorSalary: assumptions.additionalInstructorSalary * s,
    cleanerSalary: assumptions.cleanerSalary * s,
    receptionSalary: assumptions.receptionSalary * s,
  };
}

function applyDuoSessions(
  assumptions: FinanceAssumptions,
  sessions: number
): FinanceAssumptions {
  return {
    ...assumptions,
    duoSessionsPerMonth: Math.max(0, Math.round(sessions)),
  };
}

function applyStandingSpotScale(
  assumptions: FinanceAssumptions,
  scale: number
): FinanceAssumptions {
  const s = Math.max(1, scale);
  return {
    ...assumptions,
    standingSpotEnabled: true,
    products: assumptions.products.map((p) => {
      if (p.type !== "standing_spot") return p;
      const baseSeats = p.standingSpotSeatsPerClass ?? 1;
      return {
        ...p,
        standingSpotSeatsPerClass: Math.max(1, Math.round(baseSeats * s)),
      };
    }),
  };
}

function applyStandbyScale(
  assumptions: FinanceAssumptions,
  scale: number
): FinanceAssumptions {
  const s = Math.max(1, scale);
  return {
    ...assumptions,
    standbyEnabled: true,
    products: assumptions.products.map((p) => {
      if (p.type !== "standby") return p;
      const base = p.standbyExpectedAvailableEmptySeats ?? 40;
      return {
        ...p,
        standbyExpectedAvailableEmptySeats: Math.round(base * s),
      };
    }),
  };
}

function applyPrivateSessions(
  assumptions: FinanceAssumptions,
  sessions: number
): FinanceAssumptions {
  return {
    ...assumptions,
    privateSessionsPerMonth: Math.max(0, Math.round(sessions)),
  };
}

function applyClassesPerDay(
  assumptions: FinanceAssumptions,
  classes: number
): FinanceAssumptions {
  return {
    ...assumptions,
    classesPerDay: Math.max(1, Math.round(classes * 10) / 10),
  };
}

function applyReformers(
  assumptions: FinanceAssumptions,
  reformers: number
): FinanceAssumptions {
  const count = Math.max(1, Math.round(reformers));
  const perReformer =
    assumptions.reformers > 0
      ? assumptions.capexReformers / assumptions.reformers
      : assumptions.capexReformers;
  return {
    ...assumptions,
    reformers: count,
    capexReformers: perReformer * count,
  };
}

function applyFixedCostScale(
  assumptions: FinanceAssumptions,
  scale: number
): FinanceAssumptions {
  const s = Math.max(0.5, Math.min(1, scale));
  return {
    ...assumptions,
    rent: assumptions.rent * s,
    camMaintenance: assumptions.camMaintenance * s,
    additionalInstructorSalary: assumptions.additionalInstructorSalary * s,
    cleanerSalary: assumptions.cleanerSalary * s,
    receptionSalary: assumptions.receptionSalary * s,
    security: assumptions.security * s,
    internet: assumptions.internet * s,
    softwareSubscriptions: assumptions.softwareSubscriptions * s,
    accounting: assumptions.accounting * s,
    insurance: assumptions.insurance * s,
    fixedMarketingRetainer: assumptions.fixedMarketingRetainer * s,
    licences: assumptions.licences * s,
    otherFixedCosts: assumptions.otherFixedCosts * s,
    electricityBase: assumptions.electricityBase * s,
    laundry: assumptions.laundry * s,
    water: assumptions.water * s,
    cleaningSupplies: assumptions.cleaningSupplies * s,
    refreshments: assumptions.refreshments * s,
    repairsReserve: assumptions.repairsReserve * s,
    miscVariableCosts: assumptions.miscVariableCosts * s,
  };
}

function applyOtherRevenue(
  assumptions: FinanceAssumptions,
  amount: number
): FinanceAssumptions {
  return {
    ...assumptions,
    otherRevenuePerMonth: Math.max(0, amount),
  };
}

function assessOccupancyFeasibility(
  occupancyPct: number,
  model: FinanceModelOutput,
  ceiling: number
): { feasibility: FeasibilityLabel; message: string } {
  if (occupancyPct > 100) {
    return {
      feasibility: "not_feasible",
      message: "Required occupancy exceeds 100% physical capacity.",
    };
  }
  if (occupancyPct > ceiling) {
    return {
      feasibility: "not_feasible",
      message: `Required occupancy (${occupancyPct.toFixed(1)}%) exceeds operational ceiling (${ceiling}%).`,
    };
  }
  if (model.creditLiability.slotConstraintDetected && occupancyPct > 85) {
    return {
      feasibility: "high_risk",
      message:
        "Aggregate occupancy may be achievable, but peak flexible inventory would be constrained — poor booking experience for flexible members.",
    };
  }
  if (occupancyPct > 88) return { feasibility: "high_risk", message: "Very high occupancy — limited buffer for no-shows and peak demand." };
  if (occupancyPct > 82) return { feasibility: "stretch", message: "Ambitious but possible with strong retention and scheduling discipline." };
  return { feasibility: "healthy", message: "Within a healthy operational range." };
}

interface BinarySearchResult {
  value: number;
  profit: Decimal;
  feasible: boolean;
}

function binarySearchIncreasing(
  base: FinanceAssumptions,
  apply: (a: FinanceAssumptions, v: number) => FinanceAssumptions,
  low: number,
  high: number,
  target: Decimal,
  maxIterations = 48
): BinarySearchResult | null {
  const baseProfit = runFinanceModel(base).pl.netProfit;
  if (baseProfit.gte(target)) return { value: low, profit: baseProfit, feasible: true };

  const highProfit = runFinanceModel(apply(base, high)).pl.netProfit;
  if (highProfit.lt(target.minus(PROFIT_TOLERANCE_INR))) return null;

  let lo = low;
  let hi = high;
  let best: BinarySearchResult | null = null;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const profit = runFinanceModel(apply(base, mid)).pl.netProfit;
    if (profit.gte(target.minus(PROFIT_TOLERANCE_INR))) {
      best = { value: mid, profit, feasible: true };
      hi = mid;
    } else {
      lo = mid;
    }
    if (hi - lo < 0.01) break;
  }
  return best;
}

function binarySearchDecreasing(
  base: FinanceAssumptions,
  apply: (a: FinanceAssumptions, v: number) => FinanceAssumptions,
  low: number,
  high: number,
  target: Decimal
): BinarySearchResult | null {
  const highProfit = runFinanceModel(apply(base, high)).pl.netProfit;
  if (highProfit.gte(target)) return { value: high, profit: highProfit, feasible: true };

  let lo = low;
  let hi = high;
  let best: BinarySearchResult | null = null;

  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    const profit = runFinanceModel(apply(base, mid)).pl.netProfit;
    if (profit.gte(target.minus(PROFIT_TOLERANCE_INR))) {
      best = { value: mid, profit, feasible: true };
      lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo < 0.001) break;
  }
  return best;
}

export function requiredOccupancyForTargetProfit(
  base: FinanceAssumptions,
  target: Decimal,
  ceiling = 100
): SingleLeverSolverResult {
  const model = runFinanceModel(base);
  const current = base.projectedBookedOccupancyPct;
  const result = binarySearchIncreasing(
    base,
    applyOccupancy,
    current,
    ceiling,
    target
  );

  if (!result) {
    return {
      lever: "occupancy",
      label: "Occupancy",
      currentValue: current,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "Not achievable through occupancy alone within configured limits.",
      confidence: "high",
    };
  }

  const testModel = runFinanceModel(applyOccupancy(base, result.value));
  const assessment = assessOccupancyFeasibility(
    result.value,
    testModel,
    ceiling
  );

  let requiredValue = Math.round(result.value * 10) / 10;
  let verifiedModel = runFinanceModel(applyOccupancy(base, requiredValue));
  while (
    verifiedModel.pl.netProfit.lt(target.minus(PROFIT_TOLERANCE_INR)) &&
    requiredValue + 0.1 <= ceiling
  ) {
    requiredValue = Math.round((requiredValue + 0.1) * 10) / 10;
    verifiedModel = runFinanceModel(applyOccupancy(base, requiredValue));
  }

  const profitMeetsTarget = verifiedModel.pl.netProfit.gte(
    target.minus(PROFIT_TOLERANCE_INR)
  );

  return {
    lever: "occupancy",
    label: "Occupancy",
    currentValue: current,
    requiredValue,
    delta: `+${(requiredValue - current).toFixed(1)} pp`,
    projectedNetProfit: verifiedModel.pl.netProfit,
    feasible: profitMeetsTarget && assessment.feasibility !== "not_feasible",
    feasibility: assessment.feasibility,
    message: assessment.message,
    confidence: "medium",
  };
}

export function requiredRealisedRevenueForTargetProfit(
  base: FinanceAssumptions,
  target: Decimal,
  maxIncreasePct = 20
): SingleLeverSolverResult {
  const model = runFinanceModel(base);
  const current = model.revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot;
  const maxScale = 1 + maxIncreasePct / 100;

  const result = binarySearchIncreasing(
    base,
    applyPriceScale,
    1,
    maxScale,
    target
  );

  if (!result) {
    return {
      lever: "realised_revenue",
      label: "Average realised revenue / occupied spot",
      currentValue: current.toNumber(),
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: `Not achievable through pricing alone within +${maxIncreasePct}% willingness.`,
      confidence: "medium",
    };
  }

  const required = current.times(result.value);
  const increasePct = (result.value - 1) * 100;

  return {
    lever: "realised_revenue",
    label: "Average realised revenue / occupied spot",
    currentValue: current.toNumber(),
    requiredValue: required.toNumber(),
    delta: `+₹${required.minus(current).toFixed(0)} (+${increasePct.toFixed(1)}%)`,
    projectedNetProfit: result.profit,
    feasible: true,
    feasibility: increasePct > 15 ? "stretch" : increasePct > 10 ? "stretch" : "healthy",
    message: "Proportional flexible pack price increase scenario — test distribution across SKUs before committing.",
    confidence: "medium",
  };
}

export function requiredPackPricingForTargetProfit(
  base: FinanceAssumptions,
  target: Decimal,
  maxIncreasePct = 20
): SingleLeverSolverResult {
  const model = runFinanceModel(base);
  const packProducts = base.products.filter((p) => p.type === "credit_pack");
  if (packProducts.length === 0) {
    return {
      lever: "pack_pricing",
      label: "Pack pricing",
      currentValue: 0,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "No credit pack products configured.",
      confidence: "high",
    };
  }

  const current = model.revenue.weightedRevenue.weightedGroupNetSalesPerOccupiedSpot;
  const maxScale = 1 + maxIncreasePct / 100;
  const result = binarySearchIncreasing(base, applyPackPriceScale, 1, maxScale, target);

  if (!result) {
    return {
      lever: "pack_pricing",
      label: "Pack pricing",
      currentValue: current.toNumber(),
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: `Not achievable through pack pricing alone within +${maxIncreasePct}%.`,
      confidence: "medium",
    };
  }

  const increasePct = (result.value - 1) * 100;
  return {
    lever: "pack_pricing",
    label: "Pack pricing (8/16-packs only)",
    currentValue: current.toNumber(),
    requiredValue: current.times(result.value).toNumber(),
    delta: `+${increasePct.toFixed(1)}% on credit packs`,
    projectedNetProfit: result.profit,
    feasible: true,
    feasibility: increasePct > 15 ? "stretch" : "healthy",
    message: "Scales credit pack prices only — drop-in unchanged.",
    confidence: "medium",
  };
}

export function requiredOtherRevenueForTargetProfit(
  base: FinanceAssumptions,
  target: Decimal,
  maxOther = 500_000
): SingleLeverSolverResult {
  const current = base.otherRevenuePerMonth;
  const result = binarySearchIncreasing(base, applyOtherRevenue, current, maxOther, target);

  if (!result) {
    return {
      lever: "other_revenue",
      label: "Other revenue",
      currentValue: current,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "Not achievable through other revenue alone within modelled limits.",
      confidence: "low",
    };
  }

  return {
    lever: "other_revenue",
    label: "Other revenue",
    currentValue: current,
    requiredValue: Math.round(result.value),
    delta: `+₹${Math.round(result.value - current)}/month`,
    projectedNetProfit: result.profit,
    feasible: true,
    feasibility: result.value - current > 100_000 ? "stretch" : "healthy",
    message: "Workshops, retail, rentals, or other non-core revenue lines.",
    confidence: "low",
  };
}

export function requiredDuoSessionsForTargetProfit(
  base: FinanceAssumptions,
  target: Decimal,
  maxSessions = 80
): SingleLeverSolverResult {
  const model = runFinanceModel(base);
  const current = base.duoSessionsPerMonth;
  const gap = target.minus(model.pl.netProfit);

  if (gap.lte(0)) {
    return {
      lever: "duo_sessions",
      label: "Duo sessions",
      currentValue: current,
      requiredValue: current,
      delta: "0",
      projectedNetProfit: model.pl.netProfit,
      feasible: true,
      feasibility: "healthy",
      message: "Target already met.",
      confidence: "low",
    };
  }

  const marginal = marginalImpact(base, (a) => applyDuoSessions(a, a.duoSessionsPerMonth + 5));
  if (marginal.lte(0)) {
    return {
      lever: "duo_sessions",
      label: "Duo sessions",
      currentValue: current,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "Duo sessions are not contribution-positive at current pricing/cost.",
      confidence: "medium",
    };
  }

  const result = binarySearchIncreasing(base, applyDuoSessions, current, maxSessions, target);
  if (!result) {
    return {
      lever: "duo_sessions",
      label: "Duo sessions",
      currentValue: current,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: `Would exceed ${maxSessions} duo sessions/month.`,
      confidence: "low",
    };
  }

  return {
    lever: "duo_sessions",
    label: "Duo sessions",
    currentValue: current,
    requiredValue: Math.round(result.value),
    delta: `+${Math.round(result.value - current)}/month`,
    projectedNetProfit: result.profit,
    feasible: true,
    feasibility: result.value > 40 ? "stretch" : "healthy",
    message: "Requires instructor and reformer capacity for paired sessions.",
    confidence: "low",
  };
}

export function requiredStaffCostReductionForTargetProfit(
  base: FinanceAssumptions,
  target: Decimal
): SingleLeverSolverResult {
  const model = runFinanceModel(base);
  const staffTotal =
    base.additionalInstructorSalary + base.cleanerSalary + base.receptionSalary;
  const result = binarySearchDecreasing(base, applyStaffCostScale, 0.7, 1, target);

  if (!result) {
    return {
      lever: "staff_costs",
      label: "Staff costs",
      currentValue: staffTotal,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "Not achievable through staff cost reduction alone (max modelled −30%).",
      confidence: "medium",
    };
  }

  const reductionPct = (1 - result.value) * 100;
  return {
    lever: "staff_costs",
    label: "Staff costs (instructors, cleaner, reception)",
    currentValue: staffTotal,
    requiredValue: staffTotal * result.value,
    delta: `−${reductionPct.toFixed(1)}% on controllable staff lines`,
    projectedNetProfit: result.profit,
    feasible: true,
    feasibility: reductionPct > 15 ? "high_risk" : reductionPct > 8 ? "stretch" : "healthy",
    message: "Founder salary is excluded — only additional staff lines scale.",
    confidence: "medium",
  };
}

export function requiredStandingSpotForTargetProfit(
  base: FinanceAssumptions,
  target: Decimal,
  maxScale = 3
): SingleLeverSolverResult {
  const hasProduct = base.products.some((p) => p.type === "standing_spot");
  if (!hasProduct) {
    return {
      lever: "standing_spot",
      label: "Standing Spot",
      currentValue: 0,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "No Standing Spot product configured — add one on Access Products first.",
      confidence: "high",
    };
  }

  const current = totalStandingSpotCommittedSeatsMonthly(base).toNumber();
  const result = binarySearchIncreasing(base, applyStandingSpotScale, 1, maxScale, target);

  if (!result) {
    return {
      lever: "standing_spot",
      label: "Standing Spot",
      currentValue: current,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "Standing Spot expansion alone cannot close the gap within modelled limits.",
      confidence: "low",
    };
  }

  return {
    lever: "standing_spot",
    label: "Standing Spot reservations",
    currentValue: current,
    requiredValue: totalStandingSpotCommittedSeatsMonthly(
      applyStandingSpotScale(base, result.value)
    ).toNumber(),
    delta: `Scale committed reservations ×${result.value.toFixed(2)}`,
    projectedNetProfit: result.profit,
    feasible: true,
    feasibility: result.value > 2 ? "stretch" : "healthy",
    message: "Reserves reformer spots — reduces flexible inventory for drop-in/pack holders.",
    confidence: "low",
  };
}

export function requiredStandbyForTargetProfit(
  base: FinanceAssumptions,
  target: Decimal,
  maxScale = 3
): SingleLeverSolverResult {
  const standbyProduct = base.products.find((p) => p.type === "standby");
  if (!standbyProduct) {
    return {
      lever: "standby",
      label: "Standby",
      currentValue: 0,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "No Standby product configured — add one on Access Products first.",
      confidence: "high",
    };
  }

  const current = standbyProduct.standbyExpectedAvailableEmptySeats ?? 40;
  const result = binarySearchIncreasing(base, applyStandbyScale, 1, maxScale, target);

  if (!result) {
    return {
      lever: "standby",
      label: "Standby",
      currentValue: current,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "Standby inventory expansion alone cannot close the gap.",
      confidence: "low",
    };
  }

  return {
    lever: "standby",
    label: "Standby access",
    currentValue: current,
    requiredValue: Math.round(current * result.value),
    delta: `×${result.value.toFixed(2)} empty-seat inventory for standby claims`,
    projectedNetProfit: result.profit,
    feasible: true,
    feasibility: "stretch",
    message: "Uses otherwise empty seats — watch cannibalisation of full-price bookings.",
    confidence: "low",
  };
}

export function requiredPTSessionsForTargetProfit(
  base: FinanceAssumptions,
  target: Decimal,
  maxSessions = 120
): SingleLeverSolverResult {
  const model = runFinanceModel(base);
  const current = base.privateSessionsPerMonth;
  const baseProfit = model.pl.netProfit;
  const gap = target.minus(baseProfit);

  if (gap.lte(0)) {
    return {
      lever: "private_sessions",
      label: "Private training sessions",
      currentValue: current,
      requiredValue: current,
      delta: "0",
      projectedNetProfit: baseProfit,
      feasible: true,
      feasibility: "healthy",
      message: "Target already met.",
      confidence: "low",
    };
  }

  const contribPerSession = privateContributionPerSession(base);

  if (contribPerSession.lte(0)) {
    return {
      lever: "private_sessions",
      label: "Private training sessions",
      currentValue: current,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "Private sessions are not contribution-positive at current pricing/cost.",
      confidence: "high",
    };
  }

  const additionalNeeded = Math.ceil(gap.dividedBy(contribPerSession).toNumber());
  const required = current + additionalNeeded;

  if (required > maxSessions) {
    return {
      lever: "private_sessions",
      label: "Private training sessions",
      currentValue: current,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: `Would require ~${required} PT sessions/month (~${Math.ceil(required / 4)}/week) — likely exceeds instructor/reformer availability.`,
      confidence: "low",
    };
  }

  const verified = runFinanceModel(applyPrivateSessions(base, required));

  return {
    lever: "private_sessions",
    label: "Private training sessions",
    currentValue: current,
    requiredValue: required,
    delta: `+${additionalNeeded}/month (~${Math.ceil(required / 4)}/week)`,
    projectedNetProfit: verified.pl.netProfit,
    feasible: verified.pl.netProfit.gte(target.minus(PROFIT_TOLERANCE_INR)),
    feasibility: required > 60 ? "stretch" : "healthy",
    message: `Net contribution ~${contribPerSession.toFixed(0)}/session before group opportunity cost.`,
    confidence: "low",
  };
}

export function requiredFixedCostReductionForTargetProfit(
  base: FinanceAssumptions,
  target: Decimal
): SingleLeverSolverResult {
  const model = runFinanceModel(base);
  const currentScale = 1;
  const result = binarySearchDecreasing(
    base,
    applyFixedCostScale,
    0.7,
    1,
    target
  );

  if (!result) {
    return {
      lever: "fixed_costs",
      label: "Operating fixed costs",
      currentValue: model.operatingExpenses.totalFixedCosts.toNumber(),
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "Not achievable through cost reduction alone (max modelled −30%).",
      confidence: "medium",
    };
  }

  const reductionPct = (1 - result.value) * 100;
  return {
    lever: "fixed_costs",
    label: "Operating fixed costs",
    currentValue: model.operatingExpenses.totalFixedCosts.toNumber(),
    requiredValue: model.operatingExpenses.totalFixedCosts.times(result.value).toNumber(),
    delta: `−${reductionPct.toFixed(1)}% across controllable opex`,
    projectedNetProfit: result.profit,
    feasible: true,
    feasibility: reductionPct > 15 ? "high_risk" : reductionPct > 8 ? "stretch" : "healthy",
    message: "Do not cut founder salary or structurally fixed lease costs without explicit approval.",
    confidence: "medium",
  };
}

export function requiredReformersForTargetProfit(
  base: FinanceAssumptions,
  target: Decimal,
  maxReformers = 6
): SingleLeverSolverResult {
  const current = base.reformers;
  let best: { count: number; profit: Decimal } | null = null;

  for (let r = current; r <= maxReformers; r++) {
    const profit = runFinanceModel(applyReformers(base, r)).pl.netProfit;
    if (profit.gte(target.minus(PROFIT_TOLERANCE_INR))) {
      best = { count: r, profit };
      break;
    }
  }

  if (!best) {
    return {
      lever: "reformers",
      label: "Reformers",
      currentValue: current,
      requiredValue: null,
      delta: null,
      projectedNetProfit: null,
      feasible: false,
      feasibility: "not_feasible",
      message: "Additional reformer capacity alone does not close the gap — demand must grow to fill new spots.",
      confidence: "medium",
    };
  }

  const addedModel = runFinanceModel(applyReformers(base, best.count));
  const addedSpots = addedModel.capacity.monthlyAvailableSeats.minus(
    runFinanceModel(base).capacity.monthlyAvailableSeats
  );

  return {
    lever: "reformers",
    label: "Reformers",
    currentValue: current,
    requiredValue: best.count,
    delta: `+${best.count - current} reformer(s), +${addedSpots.toFixed(0)} monthly spots`,
    projectedNetProfit: best.profit,
    feasible: true,
    feasibility: best.count - current >= 2 ? "stretch" : "healthy",
    message: "Includes proportional reformer capex — revenue only increases if demand fills new capacity.",
    confidence: "medium",
  };
}

export function profitAtOccupancyCurve(
  base: FinanceAssumptions,
  levels = [40, 50, 60, 70, 75, 80, 85, 90, 95, 100]
): ProfitCurvePoint[] {
  return levels.map((occ) => {
    const model = runFinanceModel(applyOccupancy(base, occ));
    return {
      occupancyPct: occ,
      netRevenue: model.revenue.netRevenue,
      contribution: model.pl.grossProfit,
      ebitda: model.pl.ebitda,
      netProfit: model.pl.netProfit,
    };
  });
}

export function buildCostOptimisationRows(
  base: FinanceAssumptions
): CostOptimisationRow[] {
  const model = runFinanceModel(base);
  const rows: Array<{
    key: keyof FinanceAssumptions;
    label: string;
    category: CostOptimisationRow["category"];
  }> = [
    { key: "rent", label: "Rent", category: "structurally_fixed" },
    { key: "ownerInstructorSalary", label: "Founder salary", category: "do_not_cut" },
    { key: "additionalInstructorSalary", label: "Additional instructors", category: "semi_controllable" },
    { key: "fixedMarketingRetainer", label: "Marketing retainer", category: "controllable" },
    { key: "softwareSubscriptions", label: "Software", category: "controllable" },
    { key: "electricityBase", label: "Utilities (base)", category: "semi_controllable" },
    { key: "cleanerSalary", label: "Cleaning staff", category: "semi_controllable" },
    { key: "otherFixedCosts", label: "Other fixed", category: "controllable" },
  ];

  return rows.map(({ key, label, category }) => {
    const current = d((base[key] as number) ?? 0);
    const impact = (pct: number) => {
      if (category === "do_not_cut") return new Decimal(0);
      const reduced = runFinanceModel({
        ...base,
        [key]: Math.max(0, (base[key] as number) * (1 - pct / 100)),
      });
      return reduced.pl.netProfit.minus(model.pl.netProfit);
    };
    return {
      key,
      label,
      current,
      category,
      impactAt5Pct: impact(5),
      impactAt10Pct: impact(10),
      impactAt15Pct: impact(15),
    };
  });
}

export function analyseBottleneck(model: FinanceModelOutput): OptimisationAnalysis["bottleneck"] {
  const occ = model.assumptions.projectedBookedOccupancyPct;
  const breakEvenOcc = model.breakEven.contributionBreakEven.breakEvenOccupancyPct.toNumber();
  const realised = model.revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot;
  const utilisation = model.summary.utilisationPct.toNumber();
  const fixedRatio = model.pl.netRevenue.isZero()
    ? 100
    : model.operatingExpenses.totalFixedCosts
        .dividedBy(model.pl.netRevenue)
        .times(100)
        .toNumber();

  let primary: BottleneckType = "demand";
  let summary = "";

  if (model.pl.netProfit.lt(0) && fixedRatio > 70) {
    primary = "fixed_costs";
    summary = `Fixed costs consume a large share of revenue (${fixedRatio.toFixed(0)}%). The model is structurally burdened by operating overhead relative to current demand.`;
  } else if (occ > 80 && model.pl.netProfit.lt(model.pl.netRevenue.times(0.15))) {
    primary = "pricing";
    summary = `At ${occ}% occupancy, realised revenue per occupied spot (₹${realised.toFixed(0)}) is too low relative to operating cost for strong profit.`;
  } else if (utilisation > 85 && model.creditLiability.slotConstraintDetected) {
    primary = "peak_concentration";
    summary =
      "Peak-time booking pressure is the main constraint — adding aggregate demand may hurt flexible member experience.";
  } else if (occ < breakEvenOcc + 5) {
    primary = "demand";
    summary = `Occupancy (${occ}%) is near break-even (${breakEvenOcc.toFixed(0)}%). Primary gap is filling available reformer spots.`;
  } else if (model.summary.reformers <= 3 && utilisation > 75) {
    primary = "capacity";
    summary = "Pricing is reasonable, but reformer count caps absolute revenue — high occupancy creates booking pressure.";
  } else if (realised.lt(1200)) {
    primary = "pricing";
    summary = "Realised revenue per occupied reformer spot is the weakest lever relative to current cost structure.";
  } else {
    primary = "demand";
    summary = "The model needs a combination of demand, pricing, and/or high-margin services to reach ambitious profit targets.";
  }

  const supporting: BottleneckType[] = [];
  if (primary !== "fixed_costs" && fixedRatio > 55) supporting.push("fixed_costs");
  if (primary !== "pricing" && realised.lt(1500)) supporting.push("pricing");
  if (primary !== "capacity" && utilisation > 70) supporting.push("capacity");

  return { primary, summary, supporting };
}

function marginalImpact(
  base: FinanceAssumptions,
  apply: (a: FinanceAssumptions) => FinanceAssumptions
): Decimal {
  const before = runFinanceModel(base).pl.netProfit;
  const after = runFinanceModel(apply(base)).pl.netProfit;
  return after.minus(before);
}

export function rankOptimisationOpportunities(
  base: FinanceAssumptions,
  prefs: OptimisationPreferences
): OptimisationOpportunity[] {
  const p = { ...DEFAULT_PREFS, ...prefs };
  const candidates: OptimisationOpportunity[] = [];

  if (isLeverPreferredForOpportunities(p, "realised_revenue")) {
    const impact = marginalImpact(base, (a) => applyPriceScale(a, 1.05));
    candidates.push({
      rank: 0,
      lever: "realised_revenue",
      title: "Increase realised revenue per occupied spot (+5% pricing)",
      potentialImpact: impact,
      difficulty: "medium",
      capex: new Decimal(0),
      risk: "healthy",
      confidence: "medium",
      summary: "Adjust pack and drop-in pricing or mix toward higher-yield redemptions.",
    });
  }

  if (isLeverPreferredForOpportunities(p, "pack_pricing")) {
    const impact = marginalImpact(base, (a) => applyPackPriceScale(a, 1.05));
    candidates.push({
      rank: 0,
      lever: "pack_pricing",
      title: "Increase pack pricing (+5% on credit packs)",
      potentialImpact: impact,
      difficulty: "medium",
      capex: new Decimal(0),
      risk: "healthy",
      confidence: "medium",
      summary: "Raise 8/16-pack prices without changing drop-in.",
    });
  }

  if (isLeverPreferredForOpportunities(p, "private_sessions")) {
    const impact = marginalImpact(base, (a) =>
      applyPrivateSessions(a, a.privateSessionsPerMonth + 10)
    );
    candidates.push({
      rank: 0,
      lever: "private_sessions",
      title: "Add private training (+10 sessions/month)",
      potentialImpact: impact,
      difficulty: "low",
      capex: new Decimal(0),
      risk: "stretch",
      confidence: "low",
      summary: "Monetise underused afternoon reformer hours if instructor capacity exists.",
    });
  }

  if (isLeverPreferredForOpportunities(p, "occupancy")) {
    const occBump = Math.min(
      p.operationalOccupancyCeiling,
      base.projectedBookedOccupancyPct + 7
    );
    const impact = marginalImpact(base, (a) => applyOccupancy(a, occBump));
    candidates.push({
      rank: 0,
      lever: "occupancy",
      title: `Increase occupancy (${base.projectedBookedOccupancyPct}% → ${occBump}%)`,
      potentialImpact: impact,
      difficulty: "medium",
      capex: new Decimal(0),
      risk: occBump > 85 ? "high_risk" : "stretch",
      confidence: "medium",
      summary: "Fill more existing capacity before adding capex.",
    });
  }

  if (isLeverPreferredForOpportunities(p, "reformers")) {
    const impact = marginalImpact(base, (a) => applyReformers(a, a.reformers + 1));
    const capexPer = base.reformers > 0 ? base.capexReformers / base.reformers : base.capexReformers;
    candidates.push({
      rank: 0,
      lever: "reformers",
      title: "Add one reformer",
      potentialImpact: impact,
      difficulty: "high",
      capex: d(capexPer),
      risk: "stretch",
      confidence: "medium",
      summary: "Only attractive if proven unmet demand — does not auto-create revenue.",
    });
  }

  if (isLeverPreferredForOpportunities(p, "fixed_costs")) {
    const impact = marginalImpact(base, (a) => applyFixedCostScale(a, 0.95));
    candidates.push({
      rank: 0,
      lever: "fixed_costs",
      title: "Reduce controllable opex (−5%)",
      potentialImpact: impact,
      difficulty: "medium",
      capex: new Decimal(0),
      risk: "stretch",
      confidence: "medium",
      summary: "Trim marketing, software, utilities — not founder salary or rent by default.",
    });
  }

  if (isLeverPreferredForOpportunities(p, "staff_costs")) {
    const impact = marginalImpact(base, (a) => applyStaffCostScale(a, 0.95));
    candidates.push({
      rank: 0,
      lever: "staff_costs",
      title: "Reduce staff costs (−5%)",
      potentialImpact: impact,
      difficulty: "high",
      capex: new Decimal(0),
      risk: "stretch",
      confidence: "low",
      summary: "Additional instructors, cleaner, reception — founder salary excluded.",
    });
  }

  if (isLeverPreferredForOpportunities(p, "duo_sessions")) {
    const impact = marginalImpact(base, (a) =>
      applyDuoSessions(a, a.duoSessionsPerMonth + 5)
    );
    candidates.push({
      rank: 0,
      lever: "duo_sessions",
      title: "Add duo sessions (+5/month)",
      potentialImpact: impact,
      difficulty: "low",
      capex: new Decimal(0),
      risk: "healthy",
      confidence: "low",
      summary: "Paired sessions on shared reformer time.",
    });
  }

  if (isLeverPreferredForOpportunities(p, "other_revenue")) {
    const impact = marginalImpact(base, (a) =>
      applyOtherRevenue(a, a.otherRevenuePerMonth + 25_000)
    );
    candidates.push({
      rank: 0,
      lever: "other_revenue",
      title: "Add other revenue (+₹25K/month)",
      potentialImpact: impact,
      difficulty: "low",
      capex: new Decimal(0),
      risk: "healthy",
      confidence: "low",
      summary: "Retail, workshops, or ancillary income.",
    });
  }

  if (isLeverPreferredForOpportunities(p, "classes_per_day")) {
    const impact = marginalImpact(base, (a) => applyClassesPerDay(a, a.classesPerDay + 1));
    candidates.push({
      rank: 0,
      lever: "classes_per_day",
      title: "Add one class per day",
      potentialImpact: impact,
      difficulty: "medium",
      capex: new Decimal(0),
      risk: "stretch",
      confidence: "medium",
      summary: "More schedule capacity if instructors and demand exist.",
    });
  }

  if (isLeverPreferredForOpportunities(p, "standing_spot") && base.products.some((x) => x.type === "standing_spot")) {
    const impact = marginalImpact(base, (a) => applyStandingSpotScale(a, 1.25));
    candidates.push({
      rank: 0,
      lever: "standing_spot",
      title: "Expand Standing Spot reservations (+25%)",
      potentialImpact: impact,
      difficulty: "medium",
      capex: new Decimal(0),
      risk: "stretch",
      confidence: "low",
      summary: "Committed recurring spots — reduces flexible inventory.",
    });
  }

  if (isLeverPreferredForOpportunities(p, "standby") && base.products.some((x) => x.type === "standby")) {
    const impact = marginalImpact(base, (a) => applyStandbyScale(a, 1.25));
    candidates.push({
      rank: 0,
      lever: "standby",
      title: "Expand Standby empty-seat inventory (+25%)",
      potentialImpact: impact,
      difficulty: "low",
      capex: new Decimal(0),
      risk: "stretch",
      confidence: "low",
      summary: "Monetise otherwise empty seats.",
    });
  }

  return candidates
    .sort((a, b) => b.potentialImpact.minus(a.potentialImpact).toNumber())
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

function createAudit(
  target: number,
  metric: TargetMetric,
  base: FinanceAssumptions,
  changes: Partial<FinanceAssumptions>,
  verified: boolean
): OptimisationAuditRecord {
  const model = runFinanceModel({ ...base, ...changes });
  return {
    target,
    targetMetric: metric,
    baseAssumptionsId: base.id,
    changedAssumptions: changes,
    resultNetProfit: model.pl.netProfit.toNumber(),
    resultEbitda: model.pl.ebitda.toNumber(),
    verified,
    engineVersion: ENGINE_VERSION,
    formulaVersion: FORMULA_VERSION,
    optimisationVersion: OPTIMISATION_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

function verifyPath(
  base: FinanceAssumptions,
  changes: Partial<FinanceAssumptions>,
  target: Decimal
): boolean {
  const model = runFinanceModel({ ...base, ...changes });
  return model.pl.netProfit.gte(target.minus(PROFIT_TOLERANCE_INR));
}

function mergeChanges(
  base: FinanceAssumptions,
  ...parts: Partial<FinanceAssumptions>[]
): FinanceAssumptions {
  let merged = { ...base };
  for (const part of parts) {
    merged = {
      ...merged,
      ...part,
      products: part.products ?? merged.products,
      accessProductMix: part.accessProductMix ?? merged.accessProductMix,
    };
  }
  return merged;
}

export function searchCombinationPaths(
  base: FinanceAssumptions,
  target: Decimal,
  prefs: OptimisationPreferences = {}
): CombinationPath[] {
  const p = { ...DEFAULT_PREFS, ...prefs };
  const paths: CombinationPath[] = [];
  const current = runFinanceModel(base);
  const targetNum = target.toNumber();
  const occCeiling = p.operationalOccupancyCeiling;
  const pricingMode = resolvePricingMode(p);

  const occSolver = isLeverOpen(p, "occupancy")
    ? requiredOccupancyForTargetProfit(base, target, occCeiling)
    : null;
  const priceSolver =
    pricingMode === "pack_only"
      ? requiredPackPricingForTargetProfit(base, target, p.maxPriceIncreasePct)
      : pricingMode === "all_flexible"
        ? requiredRealisedRevenueForTargetProfit(base, target, p.maxPriceIncreasePct)
        : null;
  const ptSolver = isLeverOpen(p, "private_sessions")
    ? requiredPTSessionsForTargetProfit(base, target)
    : null;

  // Path A: occupancy + partial pricing + PT (balanced)
  if (isLeverOpen(p, "occupancy") && pricingMode !== "none") {
    const occTarget = Math.min(
      occCeiling,
      base.projectedBookedOccupancyPct +
        Math.max(0, ((occSolver?.requiredValue as number) ?? base.projectedBookedOccupancyPct) -
          base.projectedBookedOccupancyPct) *
          0.55
    );
    const priceScale = 1 + Math.min(p.maxPriceIncreasePct / 100, 0.06);
    const ptAdd = isLeverOpen(p, "private_sessions") ? 12 : 0;

    const changes: Partial<FinanceAssumptions> = {};
    const summary: string[] = [];
    let working = base;

    working = applyOccupancy(working, occTarget);
    summary.push(`Occupancy ${base.projectedBookedOccupancyPct}% → ${occTarget.toFixed(0)}%`);
    working = applyPricingMode(working, pricingMode, priceScale);
    summary.push(
      pricingMode === "pack_only"
        ? `Credit pack pricing +${((priceScale - 1) * 100).toFixed(0)}%`
        : `Average realised revenue → ~₹${runFinanceModel(working).revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot.toFixed(0)} (+${((priceScale - 1) * 100).toFixed(0)}%)`
    );
    if (ptAdd > 0) {
      working = applyPrivateSessions(working, base.privateSessionsPerMonth + ptAdd);
      summary.push(`PT +${ptAdd} sessions/month`);
    }

    const model = runFinanceModel(working);
    const verified = verifyPath(base, {
      projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
      projectedAttendedOccupancyPct: working.projectedAttendedOccupancyPct,
      products: working.products,
      privateSessionsPerMonth: working.privateSessionsPerMonth,
    }, target);

    if (model.pl.netProfit.gte(target.minus(PROFIT_TOLERANCE_INR * 3)) || verified) {
      paths.push({
        id: "balanced",
        name: "Balanced path",
        changes: {
          projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
          projectedAttendedOccupancyPct: working.projectedAttendedOccupancyPct,
          products: working.products,
          privateSessionsPerMonth: working.privateSessionsPerMonth,
        },
        changeSummary: summary,
        projectedNetProfit: model.pl.netProfit,
        projectedEbitda: model.pl.ebitda,
        paybackMonth: model.payback.paybackMonth,
        capexRequired: new Decimal(0),
        feasibility: occTarget > 85 ? "stretch" : "healthy",
        operationalRisk: occTarget > 82 ? "Moderate — watch peak capacity" : "Moderate",
        verified: verifyPath(base, {
          projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
          projectedAttendedOccupancyPct: working.projectedAttendedOccupancyPct,
          products: working.products,
          privateSessionsPerMonth: working.privateSessionsPerMonth,
        }, target),
        audit: createAudit(targetNum, "net_profit", base, {
          projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
          products: working.products,
          privateSessionsPerMonth: working.privateSessionsPerMonth,
        }, verified),
      });
    }
  }

  // Path B: min occupancy — pricing + PT + one extra class
  if (pricingMode !== "none" && priceSolver?.feasible) {
    const scale =
      typeof priceSolver.requiredValue === "number"
        ? (priceSolver.requiredValue as number) /
          current.revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot.toNumber()
        : 1.08;
    const clampedScale = Math.min(1 + p.maxPriceIncreasePct / 100, scale * 0.85);
    let working = applyPricingMode(
      applyOccupancy(base, Math.min(base.projectedBookedOccupancyPct + 3, occCeiling)),
      pricingMode,
      clampedScale
    );
    if (isLeverOpen(p, "private_sessions")) {
      working = applyPrivateSessions(working, base.privateSessionsPerMonth + 10);
    }
    if (isLeverOpen(p, "classes_per_day")) {
      working = applyClassesPerDay(working, base.classesPerDay + 1);
    }
    const model = runFinanceModel(working);
    if (model.pl.netProfit.gte(target.minus(PROFIT_TOLERANCE_INR * 5))) {
      paths.push({
        id: "min-occupancy",
        name: "Minimise occupancy increase",
        changes: {
          projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
          products: working.products,
          privateSessionsPerMonth: working.privateSessionsPerMonth,
          classesPerDay: working.classesPerDay,
        },
        changeSummary: [
          `Occupancy ${base.projectedBookedOccupancyPct}% → ${working.projectedBookedOccupancyPct}%`,
          pricingMode === "pack_only"
            ? `Pack pricing +${((clampedScale - 1) * 100).toFixed(0)}%`
            : `Pricing scale +${((clampedScale - 1) * 100).toFixed(0)}%`,
          `PT → ${working.privateSessionsPerMonth}/month`,
          `Classes/day → ${working.classesPerDay}`,
        ],
        projectedNetProfit: model.pl.netProfit,
        projectedEbitda: model.pl.ebitda,
        paybackMonth: model.payback.paybackMonth,
        capexRequired: new Decimal(0),
        feasibility: "stretch",
        operationalRisk: "Moderate — relies on pricing and PT demand",
        verified: verifyPath(base, {
          products: working.products,
          projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
          privateSessionsPerMonth: working.privateSessionsPerMonth,
          classesPerDay: working.classesPerDay,
        }, target),
        audit: createAudit(targetNum, "net_profit", base, {
          products: working.products,
          projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
          privateSessionsPerMonth: working.privateSessionsPerMonth,
        }, true),
      });
    }
  }

  // Path C: reformer expansion
  if (isLeverOpen(p, "reformers")) {
    const refSolver = requiredReformersForTargetProfit(base, target);
    if (refSolver.feasible && typeof refSolver.requiredValue === "number") {
      const working = applyReformers(
        applyOccupancy(base, Math.max(70, base.projectedBookedOccupancyPct - 5)),
        refSolver.requiredValue as number
      );
      const model = runFinanceModel(working);
      const capexDelta = model.capex.nonRecoverableCapex.minus(current.capex.nonRecoverableCapex);
      paths.push({
        id: "capacity",
        name: "Capacity expansion",
        changes: {
          reformers: working.reformers,
          capexReformers: working.capexReformers,
          projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
        },
        changeSummary: [
          `Reformers ${base.reformers} → ${working.reformers}`,
          `Occupancy ${working.projectedBookedOccupancyPct}% (demand must follow)`,
          `Additional capex ~₹${capexDelta.toFixed(0)}`,
        ],
        projectedNetProfit: model.pl.netProfit,
        projectedEbitda: model.pl.ebitda,
        paybackMonth: model.payback.paybackMonth,
        capexRequired: Decimal.max(0, capexDelta),
        feasibility: "stretch",
        operationalRisk: "High — requires demand to fill new capacity",
        verified: verifyPath(base, {
          reformers: working.reformers,
          capexReformers: working.capexReformers,
          projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
        }, target),
        audit: createAudit(targetNum, "net_profit", base, {
          reformers: working.reformers,
          capexReformers: working.capexReformers,
        }, true),
      });
    }
  }

  // Single-lever full solutions as reference paths
  if (occSolver?.feasible && occSolver.requiredValue !== null) {
    const working = applyOccupancy(base, occSolver.requiredValue as number);
    const model = runFinanceModel(working);
    paths.push({
      id: "occupancy-only",
      name: "Occupancy alone",
      changes: {
        projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
        projectedAttendedOccupancyPct: working.projectedAttendedOccupancyPct,
      },
      changeSummary: [`Occupancy → ${occSolver.requiredValue}%`],
      projectedNetProfit: model.pl.netProfit,
      projectedEbitda: model.pl.ebitda,
      paybackMonth: model.payback.paybackMonth,
      capexRequired: new Decimal(0),
      feasibility: occSolver.feasibility,
      operationalRisk: occSolver.message,
      verified: verifyPath(base, {
        projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
        projectedAttendedOccupancyPct: working.projectedAttendedOccupancyPct,
      }, target),
      audit: createAudit(targetNum, "net_profit", base, {
        projectedBookedOccupancyPct: working.projectedBookedOccupancyPct,
      }, true),
    });
  }

  // Sort by objective
  const sorted = [...paths].sort((a, b) => {
    switch (p.objective) {
      case "minimise_capex":
        return a.capexRequired.minus(b.capexRequired).toNumber();
      case "fastest_payback":
        return (a.paybackMonth ?? 999) - (b.paybackMonth ?? 999);
      case "maximise_profit":
        return b.projectedNetProfit.minus(a.projectedNetProfit).toNumber();
      default:
        return (
          feasibilityScore(b.feasibility) - feasibilityScore(a.feasibility) ||
          b.projectedNetProfit.minus(a.projectedNetProfit).toNumber()
        );
    }
  });

  return sorted.slice(0, 5);
}

function feasibilityScore(f: FeasibilityLabel): number {
  return { healthy: 4, stretch: 3, high_risk: 2, not_feasible: 1 }[f];
}

export function runOptimisationAnalysis(
  base: FinanceAssumptions,
  targetAmount: number,
  targetMetric: TargetMetric = "net_profit",
  prefs: OptimisationPreferences = {}
): OptimisationAnalysis {
  const p = { ...DEFAULT_PREFS, ...prefs };
  const model = runFinanceModel(base);
  const target = d(targetAmount);
  const targetGap = calculateTargetGap(model, targetAmount, targetMetric);

  const curve = profitAtOccupancyCurve(base);
  const at90 = curve.find((c) => c.occupancyPct === 90)?.netProfit ?? new Decimal(0);
  const at100 = curve.find((c) => c.occupancyPct === 100)?.netProfit ?? new Decimal(0);

  const structuralViability = {
    achievableAtOperationalCeiling:
      at90.gte(target.minus(PROFIT_TOLERANCE_INR)) || targetGap.alreadyAchieved,
    maxNetProfitAt90Pct: at90,
    maxNetProfitAt100Pct: at100,
    message:
      !targetGap.alreadyAchieved && at90.lt(target.minus(PROFIT_TOLERANCE_INR))
        ? `Target not achievable through occupancy alone. Maximum estimated net profit at ${p.operationalOccupancyCeiling}% operational occupancy is ~₹${at90.toFixed(0)} — structural changes required.`
        : null,
  };

  const singleLeverSolvers: SingleLeverSolverResult[] = [];

  if (isLeverOpen(p, "occupancy")) {
    singleLeverSolvers.push(
      requiredOccupancyForTargetProfit(base, target, p.operationalOccupancyCeiling)
    );
  }
  const pricingMode = resolvePricingMode(p);
  if (pricingMode === "all_flexible") {
    singleLeverSolvers.push(
      requiredRealisedRevenueForTargetProfit(base, target, p.maxPriceIncreasePct)
    );
  } else if (pricingMode === "pack_only") {
    singleLeverSolvers.push(
      requiredPackPricingForTargetProfit(base, target, p.maxPriceIncreasePct)
    );
  }
  if (isLeverOpen(p, "private_sessions")) {
    singleLeverSolvers.push(requiredPTSessionsForTargetProfit(base, target));
  }
  if (isLeverOpen(p, "duo_sessions")) {
    singleLeverSolvers.push(requiredDuoSessionsForTargetProfit(base, target));
  }
  if (isLeverOpen(p, "other_revenue")) {
    singleLeverSolvers.push(requiredOtherRevenueForTargetProfit(base, target));
  }
  if (isLeverOpen(p, "fixed_costs")) {
    singleLeverSolvers.push(requiredFixedCostReductionForTargetProfit(base, target));
  }
  if (isLeverOpen(p, "staff_costs")) {
    singleLeverSolvers.push(requiredStaffCostReductionForTargetProfit(base, target));
  }
  if (isLeverOpen(p, "reformers")) {
    singleLeverSolvers.push(requiredReformersForTargetProfit(base, target));
  }
  if (isLeverOpen(p, "standing_spot")) {
    singleLeverSolvers.push(requiredStandingSpotForTargetProfit(base, target));
  }
  if (isLeverOpen(p, "standby")) {
    singleLeverSolvers.push(requiredStandbyForTargetProfit(base, target));
  }

  const standbyContrib =
    isLeverOpen(p, "standby") &&
    model.accessProducts.standby?.financialOutputs.netIncrementalContribution
      ? model.accessProducts.standby.financialOutputs.netIncrementalContribution
      : new Decimal(0);
  const gap = Decimal.max(0, targetGap.gap);

  const combinationPaths = targetGap.alreadyAchieved
    ? []
    : searchCombinationPaths(base, target, p);

  return {
    targetGap,
    currentModel: {
      netProfit: model.pl.netProfit,
      ebitda: model.pl.ebitda,
      operatingCash:
        model.cashFlow.monthly[2]?.netOperatingCashFlow ??
        model.cashFlow.monthly[0].netOperatingCashFlow,
      paybackMonth: model.payback.paybackMonth,
      occupancyPct: base.projectedBookedOccupancyPct,
      realisedRevenuePerSpot: model.revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot,
      availableSpots: model.capacity.monthlyAvailableSeats,
      occupiedSpots: model.capacity.occupiedSeatsMonthly,
    },
    structuralViability,
    singleLeverSolvers,
    combinationPaths,
    opportunities: rankOptimisationOpportunities(base, p),
    bottleneck: analyseBottleneck(model),
    profitCurve: curve,
    costOptimisation: buildCostOptimisationRows(base),
    standbyInsight: {
      maxIncrementalContribution: standbyContrib,
      canCloseGapAlone: standbyContrib.gte(gap),
      message: !isLeverOpen(p, "standby")
        ? "Standby is locked — excluded from path calculations."
        : standbyContrib.lte(0)
          ? "Standby product not configured or has no incremental contribution."
          : standbyContrib.lt(gap)
            ? `Standby helps (~₹${standbyContrib.toFixed(0)}/month incremental) but cannot close the ₹${gap.toFixed(0)} gap alone.`
            : "Standby incremental contribution could materially help close the gap.",
    },
    generatedAt: new Date().toISOString(),
  };
}

export function applyCombinationPath(
  base: FinanceAssumptions,
  path: CombinationPath
): FinanceAssumptions {
  return mergeChanges(base, path.changes);
}

export {
  applyOccupancy,
  applyPriceScale,
  applyPrivateSessions,
  applyReformers,
  applyClassesPerDay,
  applyFixedCostScale,
};
