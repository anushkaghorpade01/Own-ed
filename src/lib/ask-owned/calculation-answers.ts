import type { FinanceAssumptions } from "@/lib/finance/schemas";
import type { FinanceModelOutput } from "@/lib/finance/run-model";
import { formatINR, formatPercent } from "@/lib/format/currency";
import { incomeTaxLineLabel } from "@/lib/finance/profit-view-copy";
import type { AskOwnedContext, OwnedAnswer } from "./types";
import { formatMetricCalculationBlock } from "./answer-format";
import { matchModelMetric } from "./model-metrics";
import {
  getBlendedNetSalesTrace,
  getPlanningNetProfitTrace,
  renderTraceBody,
} from "./traces";

export function isCalculationQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return (
    /how\s+(?:is|are|was|does)\s+.+\s+calculated/i.test(q) ||
    /how\s+(?:is|are)\s+.+\s+(?:computed|worked out|derived)/i.test(q) ||
    /how\s+do\s+you\s+(?:get|calculate)/i.test(q) ||
    /ebitda\s+(?:to|→|into|-)\s+net\s+profit/i.test(q) ||
    /convert.*net\s+profit/i.test(q) ||
    /from\s+ebitda\s+to\s+net/i.test(q) ||
    /what\s+(?:happens|changes)\s+(?:from|after|between)\s+ebitda/i.test(q) ||
    /bridge\s+from\s+ebitda/i.test(q) ||
    /profit\s+before\s+tax/i.test(q) ||
    (/income\s+tax/i.test(q) && /how|calculated|rate|applied/i.test(q))
  );
}

function profitBridgeAnswer(model: FinanceModelOutput, assumptions: FinanceAssumptions): OwnedAnswer {
  const { pl } = model;
  const taxLabel = incomeTaxLineLabel(assumptions.incomeTaxRatePct);

  const body = formatMetricCalculationBlock(
    "Planning net profit",
    "Net sales − direct costs − operating expenses − depreciation − interest − income tax",
    [
      { label: "Net sales", value: pl.netRevenue.toNumber() },
      { label: "− Direct costs", value: pl.directCosts.toNumber() },
      { label: "= Contribution (gross profit)", value: pl.grossProfit.toNumber() },
      { label: "− Operating expenses", value: pl.operatingExpenses.toNumber() },
      { label: "= EBITDA", value: pl.ebitda.toNumber() },
      { label: "− Depreciation", value: pl.depreciation.toNumber(), note: "non-cash" },
      { label: "= EBIT", value: pl.ebit.toNumber() },
      { label: "− Interest", value: pl.interestExpense.toNumber() },
      { label: "= Profit before tax", value: pl.profitBeforeTax.toNumber() },
      {
        label: `− ${taxLabel}`,
        value: pl.incomeTax.toNumber(),
        note: pl.profitBeforeTax.isPositive()
          ? `${assumptions.incomeTaxRatePct}% of PBT when positive`
          : "no tax when PBT ≤ 0",
      },
    ],
    pl.netProfit.toNumber(),
    "This is the full path from revenue to your planning bottom line. EBITDA shows operating strength; depreciation and interest are subtracted before tax; what remains is planning net profit — what the studio keeps after all modelled costs."
  );

  return {
    sections: [{ title: "FROM EBITDA TO PLANNING NET PROFIT", body }],
    guideLinks: [{ label: "Monthly P&L", href: "/guide#pl" }],
  };
}

function ebitdaAnswer(model: FinanceModelOutput): OwnedAnswer {
  const { pl } = model;
  const body = formatMetricCalculationBlock(
    "EBITDA",
    "Net sales − direct costs − operating expenses (same as gross profit − operating expenses)",
    [
      { label: "Net sales", value: pl.netRevenue.toNumber() },
      { label: "− Direct costs", value: pl.directCosts.toNumber() },
      { label: "= Gross profit", value: pl.grossProfit.toNumber() },
      { label: "− Operating expenses", value: pl.operatingExpenses.toNumber() },
    ],
    pl.ebitda.toNumber(),
    "EBITDA is your operating result before loan interest, tax, and equipment depreciation. If EBITDA is positive, the studio covers day-to-day running costs from sessions; it does not yet mean cash in the bank or full investment payback."
  );
  return { sections: [{ title: "HOW EBITDA IS CALCULATED", body }] };
}

function incomeTaxAnswer(model: FinanceModelOutput, assumptions: FinanceAssumptions): OwnedAnswer {
  const { pl } = model;
  const taxLabel = incomeTaxLineLabel(assumptions.incomeTaxRatePct);
  const body = formatMetricCalculationBlock(
    taxLabel,
    "Profit before tax × income tax rate (only when profit before tax > 0)",
    [
      { label: "EBITDA", value: pl.ebitda.toNumber() },
      { label: "− Depreciation", value: pl.depreciation.toNumber() },
      { label: "= EBIT", value: pl.ebit.toNumber() },
      { label: "− Interest", value: pl.interestExpense.toNumber() },
      { label: "= Profit before tax", value: pl.profitBeforeTax.toNumber() },
      {
        label: `× ${assumptions.incomeTaxRatePct}%`,
        value: pl.incomeTax.toNumber(),
        note: "rate from Assumptions → Depreciation & tax",
      },
    ],
    pl.incomeTax.toNumber(),
    `${taxLabel} is a planning placeholder for corporate tax on profitable months. It reduces planning net profit but is not cash leaving the bank in the same way as rent — your CA should confirm the right rate.`
  );
  return { sections: [{ title: taxLabel.toUpperCase(), body }] };
}

function breakEvenCalculationAnswer(
  model: FinanceModelOutput,
  assumptions: FinanceAssumptions
): OwnedAnswer {
  const be = model.breakEven.contributionBreakEven;
  const contrib = model.unitEconomics.perSeat.contributionMarginPerSeat;
  const fixed = model.operatingExpenses.totalFixedCosts;

  const body = formatMetricCalculationBlock(
    "Break-even occupancy",
    "Fixed operating costs ÷ contribution per occupied spot = required occupied spots; ÷ monthly available spots × 100",
    [
      { label: "Fixed operating costs", value: fixed.toNumber() },
      { label: "÷ Contribution per occupied spot", value: contrib.toNumber() },
      { label: "= Required occupied spots", value: be.requiredOccupiedSeats.toNumber() },
      {
        label: "÷ Monthly available spots",
        value: model.capacity.monthlyAvailableSeats.toNumber(),
      },
      {
        label: "× 100",
        value: be.breakEvenOccupancyPct.toNumber(),
        note: "percentage",
      },
    ],
    be.breakEvenOccupancyPct.toNumber(),
    `Break-even occupancy is the booked fill rate where contribution from group-class spots exactly covers fixed monthly costs. Your plan is ${formatPercent(assumptions.projectedBookedOccupancyPct, 0)} — ${be.breakEvenOccupancyPct.lte(assumptions.projectedBookedOccupancyPct) ? "at or above break-even on contribution." : "below break-even; fixed costs are not fully covered at this occupancy."}`
  );

  return {
    sections: [{ title: "HOW BREAK-EVEN OCCUPANCY IS CALCULATED", body }],
    guideLinks: [{ label: "Break-even", href: "/guide#break-even" }],
  };
}

function traceAnswer(title: string, body: string): OwnedAnswer {
  return { sections: [{ title, body }] };
}

/** Deterministic “how is this calculated?” answers with live model numbers */
export function answerCalculationQuestion(
  question: string,
  ctx: AskOwnedContext
): OwnedAnswer | null {
  const q = question.toLowerCase();
  const { model, assumptions } = ctx;

  if (
    /ebitda.*net profit|net profit.*ebitda|from ebitda|bridge.*ebitda|between ebitda|after ebitda|what happens.*ebitda|convert.*net profit|does ebitda convert/i.test(
      q
    )
  ) {
    return profitBridgeAnswer(model, assumptions);
  }

  if (/income tax|tax rate|tax calculated|tax applied/i.test(q) && /how|calculated|applied|rate/i.test(q)) {
    return incomeTaxAnswer(model, assumptions);
  }

  if (/break[- ]?even.*calculated|how.*break[- ]?even/i.test(q)) {
    return breakEvenCalculationAnswer(model, assumptions);
  }

  if (/ebitda.*calculated|how.*ebitda/i.test(q)) {
    return ebitdaAnswer(model);
  }

  if (/net profit.*calculated|planning net profit.*calculated|how.*net profit/i.test(q)) {
    const trace = getPlanningNetProfitTrace(model);
    return traceAnswer("HOW PLANNING NET PROFIT IS CALCULATED", renderTraceBody(trace, ctx));
  }

  if (/blended.*calculated|net sales per spot.*calculated|weighted.*calculated/i.test(q)) {
    const trace = getBlendedNetSalesTrace(model);
    return traceAnswer("HOW BLENDED NET SALES / SPOT IS CALCULATED", renderTraceBody(trace, ctx));
  }

  if (/how\s+(?:is|are)\s+.+\s+calculated/i.test(q)) {
    const metric = matchModelMetric(question);
    if (metric?.formula) {
      const value = metric.getValue(model, assumptions).toNumber();
      const body = formatMetricCalculationBlock(
        metric.label,
        metric.formula,
        [{ label: metric.label, value }],
        value,
        `This is a key number from your current assumptions. Change occupancy, pricing, or costs under Assumptions and this recalculates automatically.`
      );
      return { sections: [{ title: `HOW ${metric.label.toUpperCase()} IS CALCULATED`, body }] };
    }
    return null;
  }

  return null;
}
