import Decimal from "decimal.js";
import { d, WEEKS_PER_MONTH, MONTHS_PER_YEAR } from "@/lib/finance/decimal";
import type { FinanceAssumptions } from "@/lib/finance/schemas";
import type { FinanceModelOutput } from "@/lib/finance/run-model";
import { formatINR, formatPercent } from "@/lib/format/currency";

export type TimePeriod = "day" | "week" | "month" | "year";

export function parseTargetPeriod(question: string): TimePeriod | null {
  const q = question.toLowerCase();
  if (/per\s+week|weekly|each\s+week|a\s+week|\/week/.test(q)) return "week";
  if (/per\s+day|daily|each\s+day|a\s+day|\/day/.test(q)) return "day";
  if (/per\s+month|monthly|each\s+month|a\s+month|\/month/.test(q)) return "month";
  if (/per\s+year|annual|yearly|each\s+year|a\s+year|\/year/.test(q)) return "year";
  return null;
}

export function isPeriodConversionQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return (
    parseTargetPeriod(question) != null ||
    /how many.*(week|day|month|year)/i.test(q) ||
    /what (?:is|about) that/i.test(q) ||
    /convert/i.test(q) ||
    (/that/i.test(q) && /(week|day|month|year)/i.test(q))
  );
}

export function convertFromMonthly(value: number, target: TimePeriod): number {
  switch (target) {
    case "week":
      return value / WEEKS_PER_MONTH.toNumber();
    case "day":
      return value / (WEEKS_PER_MONTH.toNumber() * 7);
    case "month":
      return value;
    case "year":
      return value * MONTHS_PER_YEAR.toNumber();
  }
}

export function convertValue(
  value: number,
  fromBasis: "monthly" | "weekly" | "daily" | "annual" | "absolute",
  target: TimePeriod
): number {
  let monthly = value;
  if (fromBasis === "weekly") monthly = value * WEEKS_PER_MONTH.toNumber();
  if (fromBasis === "daily") monthly = value * WEEKS_PER_MONTH.toNumber() * 7;
  if (fromBasis === "annual") monthly = value / MONTHS_PER_YEAR.toNumber();
  if (fromBasis === "absolute") return value;
  return convertFromMonthly(monthly, target);
}

export function periodLabel(period: TimePeriod): string {
  return { day: "day", week: "week", month: "month", year: "year" }[period];
}

export function formatPeriodValue(
  value: number,
  unit: string,
  period: TimePeriod,
  isCurrency = false
): string {
  const rounded = Math.round(value * 10) / 10;
  const display = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  if (isCurrency || unit === "INR") return `${formatINR(display)} per ${periodLabel(period)}`;
  return `${display} ${unit} per ${periodLabel(period)}`;
}

export interface ModelMetricDef {
  id: string;
  aliases: RegExp[];
  label: string;
  unit: string;
  isCurrency: boolean;
  basis: "monthly" | "weekly" | "daily" | "annual" | "absolute";
  getValue: (model: FinanceModelOutput, assumptions: FinanceAssumptions) => Decimal;
  formula?: string;
}

export const MODEL_METRICS: ModelMetricDef[] = [
  {
    id: "net_profit",
    aliases: [/planning net profit/i, /net profit/i, /monthly profit/i],
    label: "Planning net profit",
    unit: "INR",
    isCurrency: true,
    basis: "monthly",
    getValue: (m) => m.pl.netProfit,
    formula: "Net sales − direct costs − operating expenses − depreciation − interest − tax",
  },
  {
    id: "ebitda",
    aliases: [/ebitda/i, /operating profit/i],
    label: "EBITDA",
    unit: "INR",
    isCurrency: true,
    basis: "monthly",
    getValue: (m) => m.pl.ebitda,
    formula: "Net sales − direct costs − operating expenses",
  },
  {
    id: "net_revenue",
    aliases: [/net sales/i, /net revenue/i, /monthly revenue/i, /^what is revenue/i, /^revenue$/i],
    label: "Net sales",
    unit: "INR",
    isCurrency: true,
    basis: "monthly",
    getValue: (m) => m.revenue.netRevenue,
    formula: "Gross customer billings − GST collected − discounts/refunds (ex-GST revenue)",
  },
  {
    id: "rent",
    aliases: [/^rent$/i, /monthly rent/i, /how much.*rent/i],
    label: "Rent",
    unit: "INR",
    isCurrency: true,
    basis: "monthly",
    getValue: (_, a) => d(a.rent),
  },
  {
    id: "contribution_per_seat",
    aliases: [/contribution per (?:seat|spot)/i, /margin per seat/i],
    label: "Contribution per occupied spot",
    unit: "INR per spot",
    isCurrency: true,
    basis: "absolute",
    getValue: (m) => m.unitEconomics.perSeat.contributionMarginPerSeat,
    formula: "Net sales per occupied spot − payment fees − consumables − instructor variable",
  },
  {
    id: "blended_net_sales",
    aliases: [/blended net sales/i, /blended revenue/i, /net sales per spot/i],
    label: "Blended net sales / occupied spot",
    unit: "INR per spot",
    isCurrency: true,
    basis: "absolute",
    getValue: (m) => m.revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot,
  },
  {
    id: "monthly_spots",
    aliases: [/monthly (?:available )?spots/i, /reformer spots/i, /available seats/i],
    label: "Monthly available reformer spots",
    unit: "spots",
    isCurrency: false,
    basis: "monthly",
    getValue: (m) => m.capacity.monthlyAvailableSeats,
  },
  {
    id: "occupied_spots",
    aliases: [/occupied spots/i, /booked spots/i],
    label: "Occupied reformer spots",
    unit: "spots",
    isCurrency: false,
    basis: "monthly",
    getValue: (m) => m.capacity.occupiedSeatsMonthly,
  },
  {
    id: "weekly_classes",
    aliases: [/weekly classes/i, /classes per week/i],
    label: "Weekly class sessions",
    unit: "classes",
    isCurrency: false,
    basis: "weekly",
    getValue: (m) => m.capacity.weeklyClasses,
  },
  {
    id: "monthly_classes",
    aliases: [/monthly classes/i, /class sessions per month/i],
    label: "Monthly class sessions",
    unit: "classes",
    isCurrency: false,
    basis: "monthly",
    getValue: (m) => m.capacity.weeklyClasses.times(WEEKS_PER_MONTH),
  },
  {
    id: "break_even_occupancy",
    aliases: [/break[- ]?even occupancy/i],
    label: "Break-even occupancy",
    unit: "%",
    isCurrency: false,
    basis: "absolute",
    getValue: (m) => m.breakEven.contributionBreakEven.breakEvenOccupancyPct,
    formula: "Fixed operating costs ÷ contribution per spot ÷ monthly available spots × 100",
  },
  {
    id: "funding_gap",
    aliases: [/funding gap/i],
    label: "Funding gap",
    unit: "INR",
    isCurrency: true,
    basis: "absolute",
    getValue: (m) => m.cashFlow.cashHealth.fundingGap,
  },
  {
    id: "launch_investment",
    aliases: [/launch investment/i, /initial investment/i, /setup investment/i],
    label: "Launch investment",
    unit: "INR",
    isCurrency: true,
    basis: "absolute",
    getValue: (m) => m.summary.launchInvestment,
  },
  {
    id: "gross_profit",
    aliases: [/gross profit/i, /contribution total/i],
    label: "Contribution (gross profit)",
    unit: "INR",
    isCurrency: true,
    basis: "monthly",
    getValue: (m) => m.pl.grossProfit,
  },
  {
    id: "operating_expenses",
    aliases: [/operating expenses/i, /total opex/i],
    label: "Operating expenses",
    unit: "INR",
    isCurrency: true,
    basis: "monthly",
    getValue: (m) => m.pl.operatingExpenses,
  },
];

export function matchModelMetric(question: string): ModelMetricDef | null {
  const q = question.trim();
  for (const metric of MODEL_METRICS) {
    if (metric.aliases.some((re) => re.test(q))) return metric;
  }
  return null;
}

export function isMetricQuantityQuestion(question: string): boolean {
  return (
    /how much/i.test(question) ||
    /how many/i.test(question) ||
    /what is my/i.test(question) ||
    /what's my/i.test(question) ||
    /tell me my/i.test(question)
  );
}

export function isDerivedRatioQuestion(question: string): boolean {
  return (
    /per class/i.test(question) ||
    /per full class/i.test(question) ||
    /per client/i.test(question) ||
    /per session/i.test(question) ||
    /per spot/i.test(question) ||
    /per reformer/i.test(question) ||
    /cost per/i.test(question) ||
    /profit per/i.test(question) ||
    /revenue per/i.test(question)
  );
}

export function isScheduleClassQuestion(question: string): boolean {
  return (
    /classes per (week|day|month)/i.test(question) ||
    /class sessions per (week|day|month)/i.test(question) ||
    /how many classes per (week|day)/i.test(question)
  );
}

export function formatMetricAnswer(
  metric: ModelMetricDef,
  value: Decimal,
  targetPeriod: TimePeriod | null
): string {
  const raw = value.toNumber();
  if (metric.unit === "%") {
    return `${metric.label}: ${formatPercent(raw)}`;
  }
  if (targetPeriod && metric.basis !== "absolute") {
    const converted = convertValue(raw, metric.basis, targetPeriod);
    return `${metric.label}: ${formatPeriodValue(converted, metric.unit, targetPeriod, metric.isCurrency)}`;
  }
  if (metric.isCurrency) return `${metric.label}: ${formatINR(raw)}`;
  const suffix =
    metric.basis === "monthly"
      ? " per month"
      : metric.basis === "weekly"
        ? " per week"
        : "";
  return `${metric.label}: ${raw.toFixed(0)} ${metric.unit}${suffix}`;
}
