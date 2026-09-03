/**
 * Month-accurate cost and price escalation for multi-year projections.
 * Cost escalation and price growth are separate — prices do not auto-rise with costs.
 */
import { d } from "../decimal";
import type {
  FinanceAssumptions,
  ForecastSettings,
  CostEscalationRule,
  CostEscalationPreset,
  Product,
} from "../schemas";
import Decimal from "decimal.js";

/** Maps escalation category → assumption field keys */
export const ESCALATION_FIELD_MAP: Record<string, Array<keyof FinanceAssumptions>> = {
  payroll: [
    "ownerInstructorSalary",
    "additionalInstructorSalary",
    "cleanerSalary",
    "receptionSalary",
  ],
  security: ["security"],
  private_instructor: ["privateInstructorCost"],
  rent: ["rent"],
  utilities: ["electricityBase", "electricityVariablePerClass", "water"],
  internet: ["internet"],
  cleaning_consumables: ["laundry", "cleaningSupplies", "sessionConsumables", "refreshments"],
  repairs: ["repairsReserve"],
  software: ["softwareSubscriptions"],
  marketing: ["fixedMarketingRetainer", "customerAcquisitionSpend"],
  general_opex: [
    "camMaintenance",
    "accounting",
    "insurance",
    "licences",
    "otherFixedCosts",
    "miscVariableCosts",
  ],
  payment_fixed_fee: ["paymentGatewayFixedFee"],
};

const PRESET_RATES: Record<
  CostEscalationPreset,
  Record<string, { annualPct: number; escalationType: CostEscalationRule["escalationType"] }>
> = {
  custom: {},
  low: {
    payroll: { annualPct: 6, escalationType: "annual_pct" },
    security: { annualPct: 6, escalationType: "annual_pct" },
    private_instructor: { annualPct: 6, escalationType: "annual_pct" },
    rent: { annualPct: 0, escalationType: "annual_pct" },
    utilities: { annualPct: 2, escalationType: "annual_pct" },
    internet: { annualPct: 2, escalationType: "annual_pct" },
    cleaning_consumables: { annualPct: 2, escalationType: "annual_pct" },
    repairs: { annualPct: 3, escalationType: "annual_pct" },
    software: { annualPct: 2, escalationType: "annual_pct" },
    marketing: { annualPct: 2, escalationType: "annual_pct" },
    general_opex: { annualPct: 2, escalationType: "annual_pct" },
  },
  base: {
    payroll: { annualPct: 9, escalationType: "annual_pct" },
    security: { annualPct: 9, escalationType: "annual_pct" },
    private_instructor: { annualPct: 9, escalationType: "annual_pct" },
    rent: { annualPct: 5, escalationType: "annual_pct" },
    utilities: { annualPct: 4, escalationType: "annual_pct" },
    internet: { annualPct: 4, escalationType: "annual_pct" },
    cleaning_consumables: { annualPct: 4, escalationType: "annual_pct" },
    repairs: { annualPct: 5, escalationType: "annual_pct" },
    software: { annualPct: 4, escalationType: "annual_pct" },
    marketing: { annualPct: 4, escalationType: "annual_pct" },
    general_opex: { annualPct: 4, escalationType: "annual_pct" },
  },
  high: {
    payroll: { annualPct: 12, escalationType: "annual_pct" },
    security: { annualPct: 12, escalationType: "annual_pct" },
    private_instructor: { annualPct: 12, escalationType: "annual_pct" },
    rent: { annualPct: 10, escalationType: "annual_pct" },
    utilities: { annualPct: 7, escalationType: "annual_pct" },
    internet: { annualPct: 7, escalationType: "annual_pct" },
    cleaning_consumables: { annualPct: 7, escalationType: "annual_pct" },
    repairs: { annualPct: 8, escalationType: "annual_pct" },
    software: { annualPct: 7, escalationType: "annual_pct" },
    marketing: { annualPct: 7, escalationType: "annual_pct" },
    general_opex: { annualPct: 7, escalationType: "annual_pct" },
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  payroll: "Payroll",
  security: "Security",
  private_instructor: "Private instructor cost",
  rent: "Rent",
  utilities: "Utilities",
  internet: "Internet",
  cleaning_consumables: "Cleaning / consumables",
  repairs: "Repairs & maintenance",
  software: "Software",
  marketing: "Marketing",
  general_opex: "General operating expenses",
  payment_fixed_fee: "Payment gateway fixed fee",
};

export function createDefaultCostEscalations(): CostEscalationRule[] {
  return Object.keys(ESCALATION_FIELD_MAP).map((categoryId) => ({
    categoryId,
    label: CATEGORY_LABELS[categoryId] ?? categoryId,
    escalationType: "annual_pct" as const,
    annualPct: PRESET_RATES.base[categoryId]?.annualPct ?? 4,
    firstEscalationMonth: 13,
    ruleBasis: "planning_default" as const,
    contractActive: false,
  }));
}

export function resolveForecastSettings(
  assumptions: FinanceAssumptions
): Required<ForecastSettings> {
  const stored = assumptions.forecastSettings;
  const baseRules = (
    stored?.costEscalations?.length ? stored.costEscalations : createDefaultCostEscalations()
  ).filter((rule) => rule.categoryId !== "instructor_delivery");

  const preset = stored?.costEscalationPreset ?? "base";
  const mergedRules = mergePresetIntoRules(baseRules, preset);

  return {
    forecastYears: stored?.forecastYears ?? 5,
    costEscalationPreset: preset,
    costEscalations: mergedRules,
    productPriceGrowth: stored?.productPriceGrowth ?? [],
    forecastTimeline: stored?.forecastTimeline ?? [],
  };
}

function mergePresetIntoRules(
  rules: CostEscalationRule[],
  preset: CostEscalationPreset
): CostEscalationRule[] {
  if (preset === "custom") return rules;
  const presetRates = PRESET_RATES[preset];
  return rules.map((rule) => {
    if (rule.contractActive || rule.ruleBasis === "contract") return rule;
    const presetRate = presetRates[rule.categoryId];
    if (!presetRate) return rule;
    return {
      ...rule,
      escalationType: presetRate.escalationType,
      annualPct: presetRate.annualPct,
      ruleBasis: "planning_default",
    };
  });
}

/** Number of compounding periods elapsed at given month */
export function escalationPeriodsAtMonth(
  month: number,
  firstEscalationMonth: number,
  intervalMonths: number
): number {
  if (month < firstEscalationMonth) return 0;
  return Math.floor((month - firstEscalationMonth) / intervalMonths) + 1;
}

export function escalationMultiplier(
  month: number,
  rule: CostEscalationRule
): Decimal {
  if (rule.escalationType === "none") return d(1);

  const first = rule.firstEscalationMonth ?? 13;

  if (rule.escalationType === "annual_pct") {
    const periods = escalationPeriodsAtMonth(month, first, 12);
    if (periods === 0) return d(1);
    const rate = d(rule.annualPct ?? 0).dividedBy(100);
    return d(1).plus(rate).pow(periods);
  }

  if (rule.escalationType === "step_pct_interval") {
    const interval = rule.stepIntervalMonths ?? 12;
    const periods = escalationPeriodsAtMonth(month, first, interval);
    if (periods === 0) return d(1);
    const rate = d(rule.stepPct ?? 0).dividedBy(100);
    return d(1).plus(rate).pow(periods);
  }

  if (rule.escalationType === "fixed_amount") {
    return d(1);
  }

  return d(1);
}

/** For fixed_amount rules, return cumulative ₹ added to base */
export function fixedAmountEscalationTotal(
  month: number,
  rule: CostEscalationRule
): number {
  if (rule.escalationType !== "fixed_amount") return 0;
  const first = rule.firstEscalationMonth ?? 13;
  const interval = rule.stepIntervalMonths ?? 12;
  const periods = escalationPeriodsAtMonth(month, first, interval);
  return (rule.fixedStepAmount ?? 0) * periods;
}

function scaleField(
  value: number,
  multiplier: Decimal,
  fixedAdd: number
): number {
  return d(value).times(multiplier).plus(fixedAdd).toNumber();
}

function applyProductPriceGrowth(
  products: Product[],
  month: number,
  priceGrowth: ForecastSettings["productPriceGrowth"]
): Product[] {
  if (!priceGrowth.length) return products;

  return products.map((product) => {
    const growth = priceGrowth.find((g) => g.productId === product.id);
    if (!growth || growth.annualIncreasePct <= 0) return product;

    const first = growth.firstIncreaseMonth ?? 13;
    const periods = escalationPeriodsAtMonth(month, first, 12);
    if (periods === 0) return product;

    const multiplier = d(1)
      .plus(d(growth.annualIncreasePct).dividedBy(100))
      .pow(periods);

    return {
      ...product,
      price: d(product.price).times(multiplier).toNumber(),
    };
  });
}

/** Return assumptions adjusted for a specific forecast month (1-indexed). */
export function applyMonthAssumptions(
  base: FinanceAssumptions,
  month: number
): FinanceAssumptions {
  const forecast = resolveForecastSettings(base);
  const rulesByCategory = new Map(
    forecast.costEscalations.map((r) => [r.categoryId, r])
  );

  const updates: Partial<FinanceAssumptions> = {};

  for (const [categoryId, fields] of Object.entries(ESCALATION_FIELD_MAP)) {
    const rule = rulesByCategory.get(categoryId);
    if (!rule || rule.escalationType === "none") continue;

    const multiplier = escalationMultiplier(month, rule);
    const fixedAdd =
      rule.escalationType === "fixed_amount"
        ? fixedAmountEscalationTotal(month, rule)
        : 0;

    for (const field of fields) {
      const current = base[field];
      if (typeof current === "number") {
        (updates as Record<string, number>)[field] = scaleField(
          current,
          multiplier,
          fixedAdd
        );
      }
    }
  }

  const products = applyProductPriceGrowth(
    base.products,
    month,
    forecast.productPriceGrowth
  );

  if (products !== base.products) {
    updates.products = products;
    const privateProduct = products.find((p) => p.type === "private");
    if (privateProduct) {
      updates.privatePrice = privateProduct.price;
    }
  }

  return { ...base, ...updates };
}

export function getForecastHorizonMonths(assumptions: FinanceAssumptions): number {
  const years = resolveForecastSettings(assumptions).forecastYears;
  return years * 12;
}
