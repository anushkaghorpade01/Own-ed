/**
 * Scenario Analysis — orchestration layer only.
 * All calculations delegate to runFinanceModel() and canonical engine modules.
 */

import type { FinanceModelOutput } from "../run-model";
import { runFinanceModel } from "../run-model";
import { d } from "../decimal";
import type { FinanceAssumptions, ScenarioTimelinePhase } from "../schemas";
import Decimal from "decimal.js";

export const ENGINE_VERSION = "1.0.0";
export const FORMULA_VERSION = "2026-09-01";

export interface ScenarioDetailMetrics {
  name: string;
  reformers: number;
  classesPerDay: number;
  operatingDaysPerWeek: number;
  monthlyAvailableSeats: Decimal;
  occupiedSeatsMonthly: Decimal;
  occupancyPct: number;
  peakOccupancyPct: number;
  avgRealisedRevenuePerCredit: Decimal;
  /** Gross billings at earned-revenue timing — NOT prepaid pack purchase cash */
  grossBillingsEarnedTiming: Decimal;
  /** @deprecated Use grossBillingsEarnedTiming — misnamed; not prepaid cash collected */
  cashCollected: Decimal;
  earnedNetRevenue: Decimal;
  contributionMarginPerSeat: Decimal;
  ebitda: Decimal;
  netProfit: Decimal;
  monthlyOperatingCashFlow: Decimal;
  breakEvenOccupancyPct: Decimal;
  paybackMonth: number | null;
  paybackNotReached: boolean;
  simplifiedPaybackMonths: number | null;
  utilisationPct: Decimal;
  creditCoverageRatio: Decimal;
  standingSpotSharePct: number;
  committedOccupancyPct: Decimal | null;
  flexibleCapacityRemaining: Decimal | null;
  standbyExpectedClaims: Decimal | null;
  privateDuoContribution: Decimal;
}

export interface AssumptionDiff {
  field: string;
  label: string;
  baseValue: string;
  scenarioValue: string;
  delta: string;
}

export interface ConstraintWarning {
  severity: "info" | "warning" | "critical";
  title: string;
  explanation: string;
}

export interface KeyDriver {
  label: string;
  changeDescription: string;
  ebitdaImpact: Decimal;
  rank: number;
}

export interface ScenarioSummary {
  paragraphs: string[];
}

export interface ScenarioAnalysisResult {
  metrics: ScenarioDetailMetrics;
  model: FinanceModelOutput;
  warnings: ConstraintWarning[];
  summary: ScenarioSummary;
}

const TRACKED_ASSUMPTION_FIELDS: Array<{
  key: keyof FinanceAssumptions;
  label: string;
  format: (v: unknown) => string;
  isPct?: boolean;
}> = [
  { key: "reformers", label: "Reformers", format: (v) => String(v) },
  { key: "classesPerDay", label: "Classes/day", format: (v) => String(v) },
  { key: "operatingDaysPerWeek", label: "Operating days/week", format: (v) => String(v) },
  {
    key: "projectedBookedOccupancyPct",
    label: "Occupancy",
    format: (v) => `${v}%`,
    isPct: true,
  },
  {
    key: "peakOccupancyPct",
    label: "Peak occupancy",
    format: (v) => `${v}%`,
    isPct: true,
  },
  { key: "rent", label: "Rent", format: (v) => `₹${Number(v).toLocaleString("en-IN")}` },
  {
    key: "privateSessionsPerMonth",
    label: "Private sessions/month",
    format: (v) => String(v),
  },
  {
    key: "creditsExpectedRedemptionBeforeExpiry",
    label: "Expected credit redemptions",
    format: (v) => String(v),
  },
];

function simplifiedPaybackMonths(
  investment: Decimal,
  monthlyEbitda: Decimal
): number | null {
  if (monthlyEbitda.lte(0)) return null;
  return Math.ceil(investment.dividedBy(monthlyEbitda).toNumber());
}

export function buildScenarioMetrics(
  assumptions: FinanceAssumptions,
  model: FinanceModelOutput
): ScenarioDetailMetrics {
  const mix = assumptions.accessProductMix;
  const standingSpotSharePct = mix?.standingSpotPct ?? 0;
  const standingSpot = model.accessProducts.standingSpot;
  const standby = model.accessProducts.standby;

  const targetOcc = assumptions.projectedBookedOccupancyPct;
  const steadyMonth =
    model.cashFlow.monthly.find(
      (m) => Math.abs(m.occupancyPct.toNumber() - targetOcc) < 3
    ) ?? model.cashFlow.monthly[model.cashFlow.monthly.length - 1];

  return {
    name: assumptions.name,
    reformers: assumptions.reformers,
    classesPerDay: assumptions.classesPerDay,
    operatingDaysPerWeek: assumptions.operatingDaysPerWeek,
    monthlyAvailableSeats: model.capacity.monthlyAvailableSeats,
    occupiedSeatsMonthly: model.capacity.occupiedSeatsMonthly,
    occupancyPct: assumptions.projectedBookedOccupancyPct,
    peakOccupancyPct: assumptions.peakOccupancyPct,
    avgRealisedRevenuePerCredit:
      model.revenue.weightedRevenue.weightedNetRevenuePerCredit,
    grossBillingsEarnedTiming: model.revenue.grossCustomerBillings,
    cashCollected: model.revenue.grossCustomerBillings,
    earnedNetRevenue: model.revenue.netRevenue,
    contributionMarginPerSeat:
      model.unitEconomics.perSeat.contributionMarginPerSeat,
    ebitda: model.pl.ebitda,
    netProfit: model.pl.netProfit,
    monthlyOperatingCashFlow: steadyMonth?.netOperatingCashFlow ?? new Decimal(0),
    breakEvenOccupancyPct:
      model.breakEven.contributionBreakEven.breakEvenOccupancyPct,
    paybackMonth: model.payback.paybackMonth,
    paybackNotReached: model.payback.paybackNotReached,
    simplifiedPaybackMonths: simplifiedPaybackMonths(
      model.payback.initialInvestment,
      model.pl.ebitda
    ),
    utilisationPct: model.summary.utilisationPct,
    creditCoverageRatio: model.creditLiability.eligibleCoverageRatio,
    standingSpotSharePct,
    committedOccupancyPct:
      standingSpot?.financialOutputs.committedClassOccupancyPct ?? null,
    flexibleCapacityRemaining:
      standingSpot?.financialOutputs.remainingFlexibleCapacity ?? null,
    standbyExpectedClaims: standby?.financialOutputs.expectedClaims ?? null,
    privateDuoContribution: model.revenue.privateRevenue.plus(
      model.revenue.duoRevenue
    ),
  };
}

export function analyzeScenario(
  assumptions: FinanceAssumptions
): ScenarioAnalysisResult {
  const model = runFinanceModel(assumptions);
  const metrics = buildScenarioMetrics(assumptions, model);
  const warnings = detectConstraintWarnings(model);
  const summary = generateScenarioSummary(metrics, model, warnings);
  return { metrics, model, warnings, summary };
}

export function diffAssumptionsFromBase(
  base: FinanceAssumptions,
  scenario: FinanceAssumptions
): AssumptionDiff[] {
  const diffs: AssumptionDiff[] = [];

  for (const field of TRACKED_ASSUMPTION_FIELDS) {
    const baseVal = base[field.key];
    const scenVal = scenario[field.key];
    if (baseVal === scenVal) continue;
    if (JSON.stringify(baseVal) === JSON.stringify(scenVal)) continue;

    let delta = "Changed";
    if (field.isPct && typeof baseVal === "number" && typeof scenVal === "number") {
      const diff = scenVal - baseVal;
      delta =
        diff >= 0
          ? `+${diff} percentage points`
          : `${diff} percentage points`;
    } else if (typeof baseVal === "number" && typeof scenVal === "number") {
      const diff = scenVal - baseVal;
      delta =
        diff >= 0
          ? `+${diff.toLocaleString("en-IN")}`
          : diff.toLocaleString("en-IN");
    }

    diffs.push({
      field: String(field.key),
      label: field.label,
      baseValue: field.format(baseVal),
      scenarioValue: field.format(scenVal),
      delta,
    });
  }

  const baseMix = base.accessProductMix;
  const scenMix = scenario.accessProductMix;
  if (baseMix && scenMix) {
    const mixKeys = [
      "flexiblePackPct",
      "standingSpotPct",
      "dropInPct",
      "standbyPct",
      "privateDuoPct",
    ] as const;
    for (const mk of mixKeys) {
      if (baseMix[mk] !== scenMix[mk]) {
        diffs.push({
          field: `accessProductMix.${mk}`,
          label: `Access mix: ${mk.replace("Pct", "")}`,
          baseValue: `${baseMix[mk]}%`,
          scenarioValue: `${scenMix[mk]}%`,
          delta: `${scenMix[mk] - baseMix[mk] >= 0 ? "+" : ""}${scenMix[mk] - baseMix[mk]}pp`,
        });
      }
    }
  }

  const baseDropIn = base.products.find((p) => p.type === "drop_in");
  const scenDropIn = scenario.products.find((p) => p.type === "drop_in");
  if (baseDropIn && scenDropIn && baseDropIn.price !== scenDropIn.price) {
    diffs.push({
      field: "drop_in.price",
      label: "Drop-in price",
      baseValue: `₹${baseDropIn.price.toLocaleString("en-IN")}`,
      scenarioValue: `₹${scenDropIn.price.toLocaleString("en-IN")}`,
      delta: `₹${(scenDropIn.price - baseDropIn.price).toLocaleString("en-IN")}`,
    });
  }

  const baseSS = base.products.find((p) => p.type === "standing_spot");
  const scenSS = scenario.products.find((p) => p.type === "standing_spot");
  if (baseSS && scenSS && baseSS.price !== scenSS.price) {
    diffs.push({
      field: "standing_spot.price",
      label: "Standing Spot monthly price",
      baseValue: `₹${baseSS.price.toLocaleString("en-IN")}`,
      scenarioValue: `₹${scenSS.price.toLocaleString("en-IN")}`,
      delta: `₹${(scenSS.price - baseSS.price).toLocaleString("en-IN")}`,
    });
  }

  return diffs;
}

export function detectConstraintWarnings(
  model: FinanceModelOutput
): ConstraintWarning[] {
  const warnings: ConstraintWarning[] = [];
  const cl = model.creditLiability;
  const ap = model.accessProducts;

  if (cl.slotConstraintDetected) {
    warnings.push({
      severity: "critical",
      title: "Peak slots constrained before overall capacity",
      explanation:
        cl.slotConstraintWarning ??
        "Overall occupancy may look acceptable, but peak-time eligible capacity for credit redemptions is tight.",
    });
  }

  if (cl.status === "red" || cl.peakStatus === "red") {
    warnings.push({
      severity: "critical",
      title: "Outstanding credits may not redeem comfortably",
      explanation: `Expected redemptions (${cl.expectedRedemptionBeforeExpiry.toFixed(0)}) vs eligible uncommitted capacity (${cl.eligibleCapacityForCredits.toFixed(0)}). Coverage ratio: ${cl.eligibleCoverageRatio.toFixed(1)}×.`,
    });
  } else if (cl.status === "amber" || cl.peakStatus === "amber") {
    warnings.push({
      severity: "warning",
      title: "Credit redemption capacity is getting tight",
      explanation: `Eligible coverage ${cl.eligibleCoverageRatio.toFixed(1)}× — monitor peak slot availability.`,
    });
  }

  const ss = ap.standingSpot;
  if (ss) {
    const reservationValue = ss.financialOutputs.capacityReservationValue;
    if (reservationValue.isNegative()) {
      warnings.push({
        severity: "warning",
        title: "Standing Spot may be underpriced vs expected flexible demand",
        explanation: `Capacity reservation value is ₹${Math.round(reservationValue.toNumber()).toLocaleString("en-IN")}/month — reserved seats may contribute less than expected flexible sales for that slot.`,
      });
    }
    const committedPct = ss.financialOutputs.committedClassOccupancyPct;
    if (committedPct.gte(50)) {
      warnings.push({
        severity: "warning",
        title: "Standing Spots consume significant peak flexible inventory",
        explanation: `${committedPct.toFixed(0)}% of each reserved class is committed before flexible bookings open.`,
      });
    }
  }

  const standby = ap.standby;
  if (
    standby &&
    standby.financialOutputs.netIncrementalContribution.isNegative()
  ) {
    warnings.push({
      severity: "warning",
      title: "Standby may cannibalise normal demand",
      explanation: `Net incremental Standby contribution is negative at ${standby.financialInputs.estimatedCannibalisationPct}% estimated cannibalisation. Break-even cannibalisation: ${standby.breakEvenCannibalisationPct.toFixed(0)}%.`,
    });
  }

  const occ = model.assumptions.projectedBookedOccupancyPct;
  const weeklyClasses =
    model.assumptions.classesPerDay * model.assumptions.operatingDaysPerWeek;
  if (occ < 50 && weeklyClasses >= 25) {
    warnings.push({
      severity: "info",
      title: "High class schedule relative to demand",
      explanation: `${weeklyClasses} weekly classes at ${occ}% occupancy — additional classes add capacity but demand may not fill them.`,
    });
  }

  return warnings;
}

export function calculateKeyDrivers(
  baseAssumptions: FinanceAssumptions
): KeyDriver[] {
  const baseModel = runFinanceModel(baseAssumptions);
  const baseEbitda = baseModel.pl.ebitda;

  const probes: Array<{
    label: string;
    changeDescription: string;
    assumptions: FinanceAssumptions;
  }> = [
    {
      label: "Occupancy +10pp",
      changeDescription: "+10 percentage points occupancy",
      assumptions: {
        ...baseAssumptions,
        projectedBookedOccupancyPct: Math.min(
          100,
          baseAssumptions.projectedBookedOccupancyPct + 10
        ),
      },
    },
    {
      label: "Realised revenue +₹100/credit",
      changeDescription: "+₹100 average realised net revenue per credit",
      assumptions: adjustDropInNetPrice(baseAssumptions, 100),
    },
    {
      label: "+1 class/day",
      changeDescription: "+1 class per day at current expected demand",
      assumptions: {
        ...baseAssumptions,
        classesPerDay: baseAssumptions.classesPerDay + 1,
      },
    },
    {
      label: "Rent +₹25,000",
      changeDescription: "+₹25,000 monthly rent",
      assumptions: {
        ...baseAssumptions,
        rent: baseAssumptions.rent + 25000,
      },
    },
    {
      label: "+1 reformer",
      changeDescription: "+1 reformer (capacity expansion)",
      assumptions: {
        ...baseAssumptions,
        reformers: baseAssumptions.reformers + 1,
      },
    },
  ];

  const drivers = probes.map((probe) => ({
    label: probe.label,
    changeDescription: probe.changeDescription,
    ebitdaImpact: runFinanceModel(probe.assumptions).pl.ebitda.minus(baseEbitda),
    rank: 0,
  }));

  drivers.sort((a, b) =>
    b.ebitdaImpact.abs().minus(a.ebitdaImpact.abs()).toNumber()
  );
  return drivers.map((driver, i) => ({ ...driver, rank: i + 1 }));
}

function adjustDropInNetPrice(
  assumptions: FinanceAssumptions,
  netIncrease: number
): FinanceAssumptions {
  const gstRate = assumptions.gstRatePct / 100;
  return {
    ...assumptions,
    products: assumptions.products.map((p) => {
      if (p.type !== "drop_in") return p;
      const currentNet =
        assumptions.priceEntryMode === "inclusive"
          ? p.price / (1 + gstRate)
          : p.price;
      const newNet = currentNet + netIncrease;
      const newPrice =
        assumptions.priceEntryMode === "inclusive"
          ? Math.round(newNet * (1 + gstRate))
          : Math.round(newNet);
      return { ...p, price: newPrice };
    }),
  };
}

export function generateScenarioSummary(
  metrics: ScenarioDetailMetrics,
  model: FinanceModelOutput,
  warnings: ConstraintWarning[]
): ScenarioSummary {
  const paragraphs: string[] = [];

  const paybackText = metrics.paybackNotReached
    ? "Investment payback is not reached within the 36-month forecast period."
    : `Investment payback occurs around month ${metrics.paybackMonth} (cumulative operating cash flow basis).`;

  paragraphs.push(
    `At ${metrics.occupancyPct}% occupancy, this scenario generates approximately ₹${Math.round(metrics.ebitda.toNumber()).toLocaleString("en-IN")} monthly EBITDA and ${metrics.netProfit.gte(0) ? "approximately" : "a net loss of"} ₹${Math.round(Math.abs(metrics.netProfit.toNumber())).toLocaleString("en-IN")} net profit on an accrual basis. ${paybackText}`
  );

  paragraphs.push(
    `The business reaches contribution break-even at approximately ${metrics.breakEvenOccupancyPct.toFixed(0)}% occupancy (${model.breakEven.contributionBreakEven.requiredOccupiedSeats.toFixed(0)} occupied seats required vs ${metrics.monthlyAvailableSeats.toFixed(0)} available).`
  );

  const drivers = calculateKeyDrivers(model.assumptions).slice(0, 2);
  if (drivers.length >= 2) {
    paragraphs.push(
      `In this model, the largest sensitivities are ${drivers[0].changeDescription} (→ ₹${Math.round(drivers[0].ebitdaImpact.toNumber()).toLocaleString("en-IN")} EBITDA impact) and ${drivers[1].changeDescription} (→ ₹${Math.round(drivers[1].ebitdaImpact.toNumber()).toLocaleString("en-IN")} EBITDA impact). These are model sensitivities, not proven causal relationships.`
    );
  }

  const peakWarning = warnings.find((w) => w.title.includes("Peak"));
  const creditWarning = warnings.find((w) => w.title.includes("credit"));
  if (peakWarning) {
    paragraphs.push(peakWarning.explanation);
  } else if (creditWarning) {
    paragraphs.push(creditWarning.explanation);
  } else if (
    metrics.standingSpotSharePct > 0 &&
    metrics.committedOccupancyPct
  ) {
    paragraphs.push(
      `Standing Spot represents ${metrics.standingSpotSharePct}% of the access mix, committing ${metrics.committedOccupancyPct.toFixed(0)}% occupancy in reserved classes before flexible bookings.`
    );
  }

  return { paragraphs };
}

export type SensitivityInputKey =
  | "occupancy"
  | "rent"
  | "classesPerDay"
  | "operatingDays"
  | "reformers"
  | "realisedRevenue"
  | "standingSpotShare"
  | "standingSpotPrice"
  | "standbyPrice"
  | "privateSessions"
  | "redemptionRate"
  | "breakage"
  | "cancellationRate";

export type SensitivityOutputKey =
  | "earnedRevenue"
  | "contribution"
  | "ebitda"
  | "netProfit"
  | "cashFlow"
  | "breakEvenOccupancy"
  | "payback"
  | "utilisation";

export function applySensitivityInput(
  base: FinanceAssumptions,
  input: SensitivityInputKey,
  value: number
): FinanceAssumptions {
  switch (input) {
    case "occupancy":
      return { ...base, projectedBookedOccupancyPct: value };
    case "rent":
      return { ...base, rent: value };
    case "classesPerDay":
      return { ...base, classesPerDay: value };
    case "operatingDays":
      return { ...base, operatingDaysPerWeek: value };
    case "reformers":
      return { ...base, reformers: value };
    case "realisedRevenue":
      return adjustDropInNetPrice(base, value - 1695);
    case "standingSpotShare":
      return {
        ...base,
        accessProductMix: {
          flexiblePackPct: Math.max(
            0,
            100 -
              value -
              (base.accessProductMix?.dropInPct ?? 10) -
              (base.accessProductMix?.standbyPct ?? 5) -
              (base.accessProductMix?.privateDuoPct ?? 10)
          ),
          standingSpotPct: value,
          dropInPct: base.accessProductMix?.dropInPct ?? 10,
          standbyPct: base.accessProductMix?.standbyPct ?? 5,
          privateDuoPct: base.accessProductMix?.privateDuoPct ?? 10,
          trialPct: base.accessProductMix?.trialPct ?? 0,
        },
      };
    case "standingSpotPrice":
      return {
        ...base,
        products: base.products.map((p) =>
          p.type === "standing_spot" ? { ...p, price: value } : p
        ),
      };
    case "standbyPrice":
      return {
        ...base,
        products: base.products.map((p) =>
          p.type === "standby" ? { ...p, price: value } : p
        ),
      };
    case "privateSessions":
      return { ...base, privateSessionsPerMonth: value };
    case "redemptionRate":
      return {
        ...base,
        creditsExpectedRedemptionBeforeExpiry: Math.round(
          base.creditsSoldOutstanding * (value / 100)
        ),
      };
    case "breakage":
      return {
        ...base,
        creditsExpectedToExpireUnused: Math.round(
          base.creditsSoldOutstanding * (value / 100)
        ),
      };
    case "cancellationRate":
      return { ...base, cancellationRatePct: value };
    default:
      return base;
  }
}

export function readSensitivityOutput(
  model: FinanceModelOutput,
  output: SensitivityOutputKey
): Decimal {
  switch (output) {
    case "earnedRevenue":
      return model.revenue.netRevenue;
    case "contribution":
      return model.unitEconomics.perSeat.contributionMarginPerSeat.times(
        model.capacity.occupiedSeatsMonthly
      );
    case "ebitda":
      return model.pl.ebitda;
    case "netProfit":
      return model.pl.netProfit;
    case "cashFlow":
      return model.cashFlow.monthly[11]?.netOperatingCashFlow ?? new Decimal(0);
    case "breakEvenOccupancy":
      return model.breakEven.contributionBreakEven.breakEvenOccupancyPct;
    case "payback":
      return d(model.payback.paybackMonth ?? 0);
    case "utilisation":
      return model.summary.utilisationPct;
    default:
      return new Decimal(0);
  }
}

export function runOneVariableSensitivity(
  base: FinanceAssumptions,
  input: SensitivityInputKey,
  output: SensitivityOutputKey,
  values: number[]
): Array<{ inputValue: number; outputValue: Decimal }> {
  return values.map((inputValue) => {
    const assumptions = applySensitivityInput(base, input, inputValue);
    const model = runFinanceModel(assumptions);
    return {
      inputValue,
      outputValue: readSensitivityOutput(model, output),
    };
  });
}

export function runTwoVariableSensitivity(
  base: FinanceAssumptions,
  inputX: SensitivityInputKey,
  inputY: SensitivityInputKey,
  output: SensitivityOutputKey,
  xValues: number[],
  yValues: number[]
): Decimal[][] {
  return xValues.map((x) =>
    yValues.map((y) => {
      let assumptions = applySensitivityInput(base, inputX, x);
      assumptions = applySensitivityInput(assumptions, inputY, y);
      return readSensitivityOutput(runFinanceModel(assumptions), output);
    })
  );
}

export function mergeAssumptionsForMonth(
  base: FinanceAssumptions,
  timeline: ScenarioTimelinePhase[],
  month: number
): FinanceAssumptions {
  const phase = timeline.find(
    (p) => month >= p.startMonth && month <= p.endMonth
  );
  if (!phase || Object.keys(phase.assumptionOverrides).length === 0) {
    return base;
  }
  return deepMergeAssumptions(base, phase.assumptionOverrides);
}

function deepMergeAssumptions(
  base: FinanceAssumptions,
  overrides: Record<string, unknown>
): FinanceAssumptions {
  const result = { ...base, ...overrides } as FinanceAssumptions;
  if (
    overrides.accessProductMix &&
    typeof overrides.accessProductMix === "object"
  ) {
    const baseMix = base.accessProductMix ?? {
      flexiblePackPct: 60,
      standingSpotPct: 15,
      dropInPct: 10,
      standbyPct: 5,
      privateDuoPct: 10,
      trialPct: 0,
    };
    result.accessProductMix = {
      ...baseMix,
      ...(overrides.accessProductMix as Partial<typeof baseMix>),
    };
  }
  if (Array.isArray(overrides.products)) {
    result.products = overrides.products as FinanceAssumptions["products"];
  }
  return result;
}

export function compareScenarios(
  baseAssumptions: FinanceAssumptions,
  scenarioAssumptions: FinanceAssumptions[]
) {
  return scenarioAssumptions.map((assumptions) => {
    const analysis = analyzeScenario(assumptions);
    return {
      metrics: analysis.metrics,
      diffs: diffAssumptionsFromBase(baseAssumptions, assumptions),
      warnings: analysis.warnings,
      summary: analysis.summary,
      model: analysis.model,
    };
  });
}

export function serializeScenarioOutputs(
  analysis: ScenarioAnalysisResult
): Record<string, unknown> {
  return {
    engineVersion: ENGINE_VERSION,
    formulaVersion: FORMULA_VERSION,
    computedAt: new Date().toISOString(),
    metrics: {
      occupancyPct: analysis.metrics.occupancyPct,
      earnedNetRevenue: analysis.metrics.earnedNetRevenue.toNumber(),
      ebitda: analysis.metrics.ebitda.toNumber(),
      netProfit: analysis.metrics.netProfit.toNumber(),
      paybackMonth: analysis.metrics.paybackMonth,
      breakEvenOccupancyPct: analysis.metrics.breakEvenOccupancyPct.toNumber(),
      utilisationPct: analysis.metrics.utilisationPct.toNumber(),
    },
    summary: analysis.summary.paragraphs,
    warningCount: analysis.warnings.length,
  };
}

export const SENSITIVITY_INPUT_OPTIONS: Array<{
  key: SensitivityInputKey;
  label: string;
  defaultValues: number[];
}> = [
  { key: "occupancy", label: "Occupancy %", defaultValues: [40, 50, 60, 70, 80, 90] },
  { key: "realisedRevenue", label: "Avg realised revenue/credit (₹ net)", defaultValues: [1400, 1500, 1600, 1700, 1800] },
  { key: "rent", label: "Rent (₹/month)", defaultValues: [80000, 90000, 100000, 120000, 150000] },
  { key: "classesPerDay", label: "Classes/day", defaultValues: [3, 4, 5, 6, 7] },
  { key: "reformers", label: "Reformers", defaultValues: [2, 3, 4, 5] },
  { key: "standingSpotShare", label: "Standing Spot share %", defaultValues: [0, 10, 15, 20, 30] },
  { key: "standingSpotPrice", label: "Standing Spot price (₹/mo)", defaultValues: [8000, 10000, 12000, 14000, 16000] },
  { key: "standbyPrice", label: "Standby price (₹/session)", defaultValues: [500, 700, 800, 1000, 1200] },
];

export const SENSITIVITY_OUTPUT_OPTIONS: Array<{
  key: SensitivityOutputKey;
  label: string;
}> = [
  { key: "ebitda", label: "EBITDA" },
  { key: "earnedRevenue", label: "Earned net revenue" },
  { key: "contribution", label: "Total contribution" },
  { key: "netProfit", label: "Net profit" },
  { key: "cashFlow", label: "Monthly operating cash flow (M12)" },
  { key: "breakEvenOccupancy", label: "Break-even occupancy %" },
  { key: "payback", label: "Payback month" },
  { key: "utilisation", label: "Capacity utilisation %" },
];
