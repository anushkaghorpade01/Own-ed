import type { DictionaryCategory, DictionaryEntry } from "@/lib/finance/finance-dictionary";
import { INCOME_TAX_LINE_TOOLTIP, incomeTaxLineLabel } from "@/lib/finance/profit-view-copy";
import { formatINR, formatPercent } from "@/lib/format/currency";
import type { AskOwnedContext } from "./types";
import { matchModelMetric } from "./model-metrics";

const CATEGORY_BUSINESS_IMPACT: Record<DictionaryCategory, string> = {
  pricing:
    "This is the price OWN actually plans on — not what the customer pays at checkout. Getting net sales right drives every revenue and profit number downstream.",
  margin:
    "This tells you how much each delivered session contributes after variable costs. Higher contribution means fewer bookings needed to cover rent and salaries.",
  profit:
    "This is how OWNED measures whether the studio earns enough from operations after costs, financing, and tax planning assumptions.",
  capacity:
    "Capacity metrics decide how many clients you can serve and whether your schedule can hit revenue targets without overbooking reformers.",
  products:
    "Different access products (drop-in, packs, Private) change mix-weighted revenue and delivery cost — your product strategy shows up here.",
  cash:
    "Cash answers “will the bank account stay positive?” Profit can look good while cash is tight because of launch spend, loans, and timing.",
  investment:
    "These metrics show how much you need to launch, when you recover it, and whether occupancy targets are realistic for survival.",
  planning:
    "Planning terms connect assumptions to forecasts — change occupancy or mix and these views update together.",
};

function plainSummary(definition: string): string {
  const first = definition.split(/(?<=[.!?])\s+/)[0] ?? definition;
  return first.trim();
}

export function businessImpactForEntry(entry: DictionaryEntry): string {
  return CATEGORY_BUSINESS_IMPACT[entry.category];
}

function liveValueForTerm(termLower: string, ctx: AskOwnedContext): string | null {
  const { model, assumptions } = ctx;
  const pl = model.pl;

  if (/net sales|net revenue|canonical price/.test(termLower)) {
    return `Monthly net sales: ${formatINR(pl.netRevenue)}`;
  }
  if (/planning net profit|net profit/.test(termLower)) {
    return `Monthly planning net profit: ${formatINR(pl.netProfit)}`;
  }
  if (/ebitda/.test(termLower) && !/break-even/.test(termLower)) {
    return `Monthly EBITDA: ${formatINR(pl.ebitda)}`;
  }
  if (/ebit[^d]|^ebit$/.test(termLower)) {
    return `Monthly EBIT: ${formatINR(pl.ebit)} (EBITDA ${formatINR(pl.ebitda)} − depreciation ${formatINR(pl.depreciation)})`;
  }
  if (/contribution margin|contribution per|cm1/.test(termLower)) {
    return `Contribution per occupied spot: ${formatINR(model.unitEconomics.perSeat.contributionMarginPerSeat)}`;
  }
  if (/occupancy|booked occupancy/.test(termLower)) {
    return `Planned booked occupancy: ${formatPercent(assumptions.projectedBookedOccupancyPct, 0)} (${model.capacity.occupiedSeatsMonthly.toFixed(0)} of ${model.capacity.monthlyAvailableSeats.toFixed(0)} spots occupied)`;
  }
  if (/break-even|breakeven/.test(termLower)) {
    const be = model.breakEven.contributionBreakEven;
    return `Break-even occupancy: ${formatPercent(be.breakEvenOccupancyPct)} (${be.requiredOccupiedSeats.toFixed(0)} occupied spots needed)`;
  }
  if (/funding gap/.test(termLower)) {
    return `Funding gap: ${formatINR(model.cashFlow.cashHealth.fundingGap)}`;
  }
  if (/depreciation/.test(termLower)) {
    return `Monthly depreciation: ${formatINR(pl.depreciation)}`;
  }
  if (/operating expenses|opex|fixed costs/.test(termLower)) {
    return `Monthly operating expenses: ${formatINR(pl.operatingExpenses)}`;
  }
  if (/income tax|tax rate/.test(termLower)) {
    return `${incomeTaxLineLabel(assumptions.incomeTaxRatePct)}: ${formatINR(pl.incomeTax)} on profit before tax ${formatINR(pl.profitBeforeTax)}`;
  }
  if (/interest/.test(termLower)) {
    return `Monthly interest: ${formatINR(pl.interestExpense)}`;
  }
  if (/gross profit|contribution total/.test(termLower)) {
    return `Monthly contribution (gross profit): ${formatINR(pl.grossProfit)}`;
  }
  return null;
}

export function formatDictionaryAnswer(entry: DictionaryEntry, ctx: AskOwnedContext): string {
  const parts: string[] = [
    "WHAT IT MEANS",
    "",
    plainSummary(entry.definition),
    "",
    entry.definition,
  ];

  if (entry.formula) {
    parts.push("", "FORMULA IN OWNED", "", entry.formula);
  } else {
    const metric = matchModelMetric(entry.term);
    if (metric?.formula) {
      parts.push("", "FORMULA IN OWNED", "", metric.formula);
    }
  }

  const live = liveValueForTerm(entry.term.toLowerCase(), ctx);
  if (live) {
    parts.push("", "YOUR MODEL RIGHT NOW", "", live);
  }

  parts.push("", "WHY IT MATTERS FOR YOUR BUSINESS", "", businessImpactForEntry(entry));

  if (entry.example) {
    parts.push("", "EXAMPLE", "", entry.example);
  }
  if (entry.notTheSameAs) {
    parts.push("", "NOT THE SAME AS", "", entry.notTheSameAs);
  }

  if (/income tax/.test(entry.term.toLowerCase())) {
    parts.push("", "HOW TAX IS APPLIED", "", INCOME_TAX_LINE_TOOLTIP);
  }

  return parts.join("\n");
}

export function formatMetricCalculationBlock(
  label: string,
  formula: string,
  steps: Array<{ label: string; value: number | string; note?: string }>,
  result: number,
  businessLine: string
): string {
  const lines = [
    "WHAT IT MEANS",
    "",
    businessLine,
    "",
    "FORMULA IN OWNED",
    "",
    formula,
    "",
    "CALCULATION (YOUR MODEL)",
    "",
  ];
  for (const step of steps) {
    const val = typeof step.value === "number" ? formatINR(step.value) : step.value;
    lines.push(step.note ? `${step.label}: ${val} (${step.note})` : `${step.label}: ${val}`);
  }
  lines.push("", `Result: ${formatINR(result)}`);
  return lines.join("\n");
}
