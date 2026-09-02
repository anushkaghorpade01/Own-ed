import Decimal from "decimal.js";
import { d } from "@/lib/finance/decimal";
import type { FinanceModelOutput } from "@/lib/finance/run-model";
import type { FinanceAssumptions } from "@/lib/finance/schemas";
import { formatINR } from "@/lib/format/currency";
import type { MetricTrace, AskOwnedContext } from "./types";
import { getOwnedPageContext } from "./page-context";

export function getBlendedNetSalesTrace(model: FinanceModelOutput): MetricTrace {
  const wr = model.revenue.weightedRevenue;
  const inputs = wr.serviceBookingBreakdown.map((row) => ({
    label: row.product.name,
    value: row.weightedNetSalesImpact.toNumber(),
    formula: `${row.serviceBookingMixPct.toFixed(1)}% × ${formatINR(row.netSalesPerOccupiedBooking)} = ${formatINR(row.weightedNetSalesImpact)}`,
  }));

  return {
    metric: "Blended net sales / occupied spot",
    formula: "Sum of (service mix % × net sales per occupied booking) for each product",
    inputs,
    result: wr.blendedNetSalesPerOccupiedSpot.toNumber(),
  };
}

export function getPlanningNetProfitTrace(model: FinanceModelOutput): MetricTrace {
  const { pl, revenue, directCosts, operatingExpenses } = model;
  return {
    metric: "Planning net profit",
    formula: "Net sales − Direct costs − Operating expenses − Depreciation − Interest − Tax",
    inputs: [
      { label: "Net sales", value: pl.netRevenue.toNumber() },
      { label: "Direct costs", value: directCosts.totalDirectCosts.toNumber() },
      { label: "Operating expenses", value: operatingExpenses.totalOperatingExpenses.toNumber() },
      { label: "Depreciation", value: pl.depreciation.toNumber() },
      { label: "Interest", value: pl.interestExpense.toNumber() },
      { label: "Tax", value: pl.incomeTax.toNumber() },
    ],
    result: pl.netProfit.toNumber(),
  };
}

export function getMetricTraceForPage(ctx: AskOwnedContext): MetricTrace | null {
  const page = getOwnedPageContext(ctx.pathname);
  if (page.route.includes("/unit-economics") || page.route.includes("/access-products/mix")) {
    return getBlendedNetSalesTrace(ctx.model);
  }
  if (page.route.includes("/pl") || page.route.includes("/sales-target")) {
    return getPlanningNetProfitTrace(ctx.model);
  }
  if (page.route.includes("/cash-flow")) {
    const health = ctx.model.cashFlow.cashHealth;
    return {
      metric: "Funding gap",
      formula: "max(0, −lowest bank cash balance)",
      inputs: [
        { label: "Lowest bank cash", value: health.lowestBankCash.toNumber() },
        { label: "Lowest cash month", value: health.lowestBankCashMonth },
        { label: "Total planned funding", value: health.totalPlannedFunding.toNumber() },
      ],
      result: health.fundingGap.toNumber(),
    };
  }
  if (page.route.includes("/payback")) {
    const last = ctx.model.cashFlow.monthly[ctx.model.cashFlow.monthly.length - 1];
    return {
      metric: "Recovery position",
      formula: "Cumulative operating cash generated − payback investment base",
      inputs: [
        {
          label: "Cumulative operating cash",
          value: (last?.cumulativeOperatingCashGenerated ?? d(0)).toNumber(),
        },
        {
          label: "Payback investment base",
          value: ctx.model.cashFlow.initialInvestment.toNumber(),
        },
      ],
      result: (last?.recoveryPosition ?? d(0)).toNumber(),
    };
  }
  return null;
}

const TRACE_BUSINESS_MEANING: Record<string, string> = {
  "Planning net profit":
    "This is your planning bottom line after all modelled costs. Positive means the studio model earns more than it spends in a typical month at target occupancy.",
  "Blended net sales / occupied spot":
    "This is the average net revenue OWN expects from each booked reformer spot, weighted by your service demand mix. It drives break-even and unit economics.",
  "Funding gap":
    "Extra founder cash needed so the bank balance never goes negative during the forecast. If this is zero, planned funding covers the lowest cash point.",
  "Recovery position":
    "How much operating cash has been generated versus what you invested at launch. Below zero means investment is not yet recovered.",
};

export function renderTraceBody(trace: MetricTrace, ctx?: AskOwnedContext): string {
  const business =
    TRACE_BUSINESS_MEANING[trace.metric] ??
    `This number comes from ${trace.metric.toLowerCase()} in your current assumptions.`;

  const lines = [
    "WHAT IT MEANS",
    "",
    business,
    "",
    "FORMULA IN OWNED",
    "",
    trace.formula,
    "",
    "CALCULATION (YOUR MODEL)",
    "",
  ];

  for (const input of trace.inputs) {
    if (input.formula) {
      lines.push(`${input.label}: ${input.formula}`);
    } else if (typeof input.value === "number" && input.label.toLowerCase().includes("month")) {
      lines.push(`${input.label}: ${input.value}`);
    } else if (typeof input.value === "number") {
      lines.push(`${input.label}: ${formatINR(input.value)}`);
    } else {
      lines.push(`${input.label}: ${input.value}`);
    }
  }

  lines.push("", `Result: ${formatINR(trace.result)}`);

  if (ctx && trace.metric === "Planning net profit") {
    const { pl } = ctx.model;
    lines.push(
      "",
      "FULL BRIDGE (EBITDA → NET PROFIT)",
      "",
      `EBITDA: ${formatINR(pl.ebitda)}`,
      `− Depreciation: ${formatINR(pl.depreciation)} = EBIT ${formatINR(pl.ebit)}`,
      `− Interest: ${formatINR(pl.interestExpense)} = PBT ${formatINR(pl.profitBeforeTax)}`,
      `− Income tax: ${formatINR(pl.incomeTax)} = Planning net profit ${formatINR(pl.netProfit)}`
    );
  }

  return lines.join("\n");
}

export function extractMonthFromQuestion(question: string, fallback: number): number {
  const m = question.match(/month\s*(\d{1,2})/i);
  if (m) {
    const n = parseInt(m[1]!, 10);
    if (n >= 1 && n <= 36) return n;
  }
  return fallback;
}
