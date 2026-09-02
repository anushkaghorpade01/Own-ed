import type { FinanceAssumptions, Product } from "@/lib/finance/schemas";
import { SalesTargetPreferencesSchema, ForecastSettingsSchema } from "@/lib/finance/schemas";
import { runFinanceModel } from "@/lib/finance/run-model";
import { parseIndianAmount } from "./parse-indian-number";
import type { WhatIfResult } from "./types";

export type WhatIfVariable =
  | "rent"
  | "occupancy"
  | "private"
  | "drop_in"
  | "8_pack"
  | "16_pack"
  | "reformers"
  | "target_profit"
  | "payroll_escalation";

export interface ParsedWhatIf {
  variable: WhatIfVariable;
  value: number;
  label: string;
}

const VALUE_PATTERN =
  /(?:₹?\s*)?(\d[\d,.\s]*(?:\.\d+)?\s*(?:%|k|lakh|lakhs|l|lac|lacs)?|\d[\d,.\s]*)/i;

function findProduct(
  products: Product[],
  kind: "drop_in" | "8_pack" | "16_pack" | "private"
): Product | undefined {
  if (kind === "private") return products.find((p) => p.type === "private");
  if (kind === "drop_in") return products.find((p) => p.type === "drop_in");
  if (kind === "8_pack") {
    return products.find(
      (p) => p.type === "credit_pack" && (p.id.includes("8") || p.name.includes("8"))
    );
  }
  return products.find(
    (p) => p.type === "credit_pack" && (p.id.includes("16") || p.name.includes("16"))
  );
}

function patchProductPrice(
  assumptions: FinanceAssumptions,
  product: Product,
  price: number
): Partial<FinanceAssumptions> {
  const patch: Partial<FinanceAssumptions> = {
    products: assumptions.products.map((p) =>
      p.id === product.id ? { ...p, price: Math.round(price) } : p
    ),
  };
  if (product.type === "private") {
    patch.privatePrice = Math.round(price);
  }
  return patch;
}

export function parseWhatIfQuestion(question: string): ParsedWhatIf | null {
  const q = question.toLowerCase();
  if (!/what\s+(?:if|happens\s+if)|what\s+would\s+happen/i.test(q)) {
    return null;
  }

  const valueMatch = q.match(VALUE_PATTERN);
  const rawValue = valueMatch?.[1];
  if (!rawValue) return null;

  const value = parseIndianAmount(rawValue.replace(/\s+/g, ""));
  if (value === null) return null;

  if (/rent/.test(q)) {
    return { variable: "rent", value, label: `Rent = ${value}` };
  }
  if (/occupancy|utilisation|utilization/.test(q)) {
    const pct = rawValue.includes("%") || value <= 100 ? value : value;
    return { variable: "occupancy", value: pct, label: `Occupancy = ${pct}%` };
  }
  if (/private/.test(q)) {
    return { variable: "private", value, label: `Private price = ₹${Math.round(value)}` };
  }
  if (/drop[- ]?in/.test(q)) {
    return { variable: "drop_in", value, label: `Drop-in price = ₹${Math.round(value)}` };
  }
  if (/8[- ]?pack|eight[- ]?pack/.test(q)) {
    return { variable: "8_pack", value, label: `8-pack price = ₹${Math.round(value)}` };
  }
  if (/16[- ]?pack|sixteen[- ]?pack/.test(q)) {
    return { variable: "16_pack", value, label: `16-pack price = ₹${Math.round(value)}` };
  }
  if (/reformer/.test(q)) {
    return { variable: "reformers", value: Math.round(value), label: `Reformers = ${Math.round(value)}` };
  }
  if (/target\s+profit|profit\s+target/.test(q)) {
    return {
      variable: "target_profit",
      value,
      label: `Target profit = ₹${Math.round(value)}`,
    };
  }
  if (/payroll\s+escalation|payroll/.test(q)) {
    return {
      variable: "payroll_escalation",
      value,
      label: `Payroll escalation = ${value}%`,
    };
  }

  return null;
}

export function buildWhatIfPatch(
  assumptions: FinanceAssumptions,
  parsed: ParsedWhatIf
): Partial<FinanceAssumptions> {
  switch (parsed.variable) {
    case "rent":
      return { rent: Math.round(parsed.value) };
    case "occupancy":
      return { projectedBookedOccupancyPct: parsed.value };
    case "reformers":
      return { reformers: Math.max(1, Math.round(parsed.value)) };
    case "target_profit": {
      const prefs = SalesTargetPreferencesSchema.parse({
        ...assumptions.salesTargetPreferences,
        targetMonthlyNetProfit: Math.round(parsed.value),
      });
      return { salesTargetPreferences: prefs };
    }
    case "payroll_escalation": {
      const settings = ForecastSettingsSchema.parse(assumptions.forecastSettings ?? {});
      const rules = [...settings.costEscalations];
      const idx = rules.findIndex((r) => r.categoryId === "payroll");
      if (idx >= 0) {
        rules[idx] = { ...rules[idx]!, annualPct: parsed.value, ruleBasis: "custom" };
      } else {
        rules.push({
          categoryId: "payroll",
          label: "Payroll",
          escalationType: "annual_pct",
          annualPct: parsed.value,
          ruleBasis: "custom",
          firstEscalationMonth: 13,
          contractActive: false,
        });
      }
      return { forecastSettings: { ...settings, costEscalations: rules } };
    }
    case "private": {
      const product = findProduct(assumptions.products, "private");
      return product ? patchProductPrice(assumptions, product, parsed.value) : {};
    }
    case "drop_in": {
      const product = findProduct(assumptions.products, "drop_in");
      return product ? patchProductPrice(assumptions, product, parsed.value) : {};
    }
    case "8_pack": {
      const product = findProduct(assumptions.products, "8_pack");
      return product ? patchProductPrice(assumptions, product, parsed.value) : {};
    }
    case "16_pack": {
      const product = findProduct(assumptions.products, "16_pack");
      return product ? patchProductPrice(assumptions, product, parsed.value) : {};
    }
    default:
      return {};
  }
}

export function runOwnedWhatIf(
  assumptions: FinanceAssumptions,
  parsed: ParsedWhatIf
): WhatIfResult | null {
  const patch = buildWhatIfPatch(assumptions, parsed);
  if (Object.keys(patch).length === 0) return null;

  const baseModel = runFinanceModel(assumptions);
  const merged = { ...assumptions, ...patch } as FinanceAssumptions;
  const whatIfModel = runFinanceModel(merged);

  const baseNetProfit = baseModel.pl.netProfit.toNumber();
  const whatIfNetProfit = whatIfModel.pl.netProfit.toNumber();

  return {
    label: parsed.label,
    patch,
    baseNetProfit,
    whatIfNetProfit,
    delta: whatIfNetProfit - baseNetProfit,
    baseBlended: baseModel.revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot.toNumber(),
    whatIfBlended:
      whatIfModel.revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot.toNumber(),
  };
}

export const WHAT_IF_UNSUPPORTED_MESSAGE =
  "I can currently run what-if checks for pricing, rent, occupancy, reformers, target profit and selected costs.";
