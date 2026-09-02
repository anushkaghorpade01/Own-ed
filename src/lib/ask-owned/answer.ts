import { classifyOwnedQuestion } from "./classify";
import { getOwnedPageContext } from "./page-context";
import { searchOwnedGuide, guideHref } from "./guide-search";
import {
  getMetricTraceForPage,
  renderTraceBody,
  extractMonthFromQuestion,
} from "./traces";
import {
  parseWhatIfQuestion,
  runOwnedWhatIf,
  WHAT_IF_UNSUPPORTED_MESSAGE,
} from "./what-if";
import { runOwnedHealthChecks, renderHealthCheckAnswer } from "./health-checks";
import {
  extractTermQuery,
  TERM_GUIDE_MAP,
  DIFFERENCE_ANSWERS,
} from "./terms";
import { searchDictionary } from "@/lib/finance/finance-dictionary";
import { formatINR, formatPercent } from "@/lib/format/currency";
import {
  getMonthForecastProfit,
  runSalesTargetAnalysis,
  evaluateSalesPlan,
} from "@/lib/finance/engine/sales-client-target";
import { SalesTargetPreferencesSchema } from "@/lib/finance/schemas";
import type { AskOwnedContext, OwnedAnswer } from "./types";
import {
  isClassCountQuestion,
  answerClassCountQuestion,
} from "./capacity-answers";
import { tryAnswerMathQuestion } from "./math-router";

export function answerOwnedQuestion(question: string, ctx: AskOwnedContext): OwnedAnswer {
  const mathAnswer = tryAnswerMathQuestion(question, ctx);
  if (mathAnswer) return mathAnswer;

  const category = classifyOwnedQuestion(question, ctx.pathname);
  const page = getOwnedPageContext(ctx.pathname);

  switch (category) {
    case "WHAT_IF":
      return handleWhatIf(question, ctx);
    case "MODEL_HEALTH_CHECK":
      return handleHealthCheck(ctx);
    case "COMPARE_PROFIT_VIEWS":
      return handleProfitComparison(question, ctx);
    case "PROFIT_VS_CASH":
      return handleProfitVsCash(ctx);
    case "INVESTMENT_RECOVERY":
      return handleInvestmentRecovery(question, ctx);
    case "BANK_CASH":
    case "FUNDING":
      return handleBankCash(ctx);
    case "SALES_CLIENT_TARGET":
      return handleSalesTarget(question, ctx);
    case "BREAK_EVEN":
      return handleBreakEven(ctx);
    case "CAPACITY":
      return handleCapacity(question, ctx);
    case "OCCUPANCY":
      return handleOccupancy(question, ctx);
    case "EXPLAIN_METRIC":
      return handleExplainMetric(question, ctx, page.title);
    case "EXPLAIN_TERM":
      return handleExplainTerm(question, ctx);
    case "SERVICE_MIX":
    case "CREDITS":
    case "PRICING":
      return handleGuideSearch(question, ctx);
    case "GUIDE_SEARCH":
    case "UNKNOWN":
      return handleGuideSearch(question, ctx);
    default:
      return handleUnknown(question, ctx);
  }
}

function handleWhatIf(question: string, ctx: AskOwnedContext): OwnedAnswer {
  const parsed = parseWhatIfQuestion(question);
  if (!parsed) {
    return {
      sections: [{ body: WHAT_IF_UNSUPPORTED_MESSAGE }],
    };
  }
  const result = runOwnedWhatIf(ctx.assumptions, parsed);
  if (!result) {
    return {
      sections: [{ body: WHAT_IF_UNSUPPORTED_MESSAGE }],
    };
  }

  const deltaSign = result.delta >= 0 ? "+" : "−";
  const body = [
    `WHAT IF ${result.label.toUpperCase()}?`,
    "",
    `Current planning net profit: ${formatINR(result.baseNetProfit)}`,
    `What-if planning net profit: ${formatINR(result.whatIfNetProfit)}`,
    `Change: ${deltaSign}${formatINR(Math.abs(result.delta))}`,
  ];
  if (result.baseBlended !== undefined && result.whatIfBlended !== undefined) {
    body.push(
      "",
      `Blended net sales / occupied spot: ${formatINR(result.baseBlended)} → ${formatINR(result.whatIfBlended)}`
    );
  }
  body.push("", "This is a temporary preview. Your assumptions are not changed until you apply.");

  return {
    sections: [{ body: body.join("\n") }],
    whatIfApply: { label: "Apply to assumptions", patch: result.patch },
  };
}

function handleHealthCheck(ctx: AskOwnedContext): OwnedAnswer {
  const checks = runOwnedHealthChecks(ctx.model);
  const rendered = renderHealthCheckAnswer(checks);
  return { sections: rendered.sections };
}

function handleProfitComparison(question: string, ctx: AskOwnedContext): OwnedAnswer {
  const prefs = SalesTargetPreferencesSchema.parse({
    targetMonth: 8,
    targetMonthlyNetProfit: 200_000,
    ...ctx.assumptions.salesTargetPreferences,
  });
  const month = extractMonthFromQuestion(question, prefs.targetMonth);
  const forecast = getMonthForecastProfit(ctx.assumptions, month);
  const steady = ctx.model.pl.netProfit;
  const analysis = runSalesTargetAnalysis(ctx.assumptions);
  const customQty = prefs.customSalesQuantitiesByProductId ?? {};
  const hasCustom = Object.values(customQty).some((v) => v > 0);
  const salesPlan = hasCustom
    ? evaluateSalesPlan(ctx.assumptions, customQty, month, prefs.targetMonthlyNetProfit)
    : analysis.suggestedMix;
  const monthSnap =
    ctx.model.monthlyProjection.find((m) => m.month === month) ??
    ctx.model.monthlyProjection[month - 1];
  const monthOcc = monthSnap?.occupancyPct?.toNumber();

  const includesInvestment = /investment/i.test(question);
  if (includesInvestment) {
    return {
      sections: [
        {
          title: "WHAT THIS MEANS",
          body: `No. Month ${month} planning net profit is the profit for Month ${month} itself (${formatINR(forecast)}). Initial investment is tracked separately under Investment Recovery and Cash.`,
        },
      ],
      guideLinks: [{ label: "Investment Recovery", href: guideHref("payback") }],
    };
  }

  return {
    sections: [
      {
        title: "WHY THESE NUMBERS DIFFER",
        body: [
          "These are three different profit views in OWNED:",
          "",
          `Month ${month} forecast profit — what OWNED expects in that specific month during ramp-up.`,
          `  Occupancy: ${monthOcc != null ? `${Number(monthOcc).toFixed(1)}%` : "from projection"}`,
          `  Planning net profit: ${formatINR(forecast)}`,
          "",
          "Steady-state monthly profit — a normal established month at target occupancy.",
          `  Occupancy: ${formatPercent(ctx.assumptions.projectedBookedOccupancyPct, 0)}`,
          `  Planning net profit: ${formatINR(steady)}`,
          "",
          "Your sales plan profit — if you sell exactly the quantities in Your Sales Plan.",
          `  Planning net profit: ${formatINR(salesPlan.planningNetProfit)}`,
          "",
          "They answer different questions, so they can legitimately differ.",
        ].join("\n"),
      },
    ],
    guideLinks: [{ label: "Why am I seeing different profit numbers?", href: guideHref("profit-views") }],
  };
}

function handleProfitVsCash(ctx: AskOwnedContext): OwnedAnswer {
  const { pl, cashFlow } = ctx.model;
  const health = cashFlow.cashHealth;
  return {
    sections: [
      {
        title: "PROFIT VS CASH",
        body: [
          "Profit measures the economic result of operations for a month.",
          "Cash shows how much money actually enters and leaves your bank account.",
          "",
          `Current steady-state planning net profit: ${formatINR(pl.netProfit)}`,
          `Lowest bank cash: ${formatINR(health.lowestBankCash)} (month ${health.lowestBankCashMonth})`,
          "",
          "Common reasons they differ:",
          "• Founder funding and loans",
          "• Setup investment (capex) paid at launch",
          "• Deposits and working capital",
          "• Loan repayments",
          "• Timing of customer prepayments vs when revenue is recognised",
          "• Depreciation (in profit, not cash)",
        ].join("\n"),
      },
    ],
    guideLinks: [{ label: "Don't confuse these", href: guideHref("dont-confuse") }],
  };
}

function handleInvestmentRecovery(question: string, ctx: AskOwnedContext): OwnedAnswer {
  const { payback, cashFlow, capex } = ctx.model;
  const health = cashFlow.cashHealth;
  const last = cashFlow.monthly[cashFlow.monthly.length - 1];
  const position = last?.recoveryPosition;
  const positionNum = position?.toNumber() ?? 0;

  if (/zero\s+line|graph|mean/i.test(question)) {
    return {
      sections: [
        {
          title: "WHAT THIS MEANS",
          body: [
            "The recovery line tracks cumulative operating cash against your payback investment base.",
            "",
            "Below ₹0 — investment still to recover.",
            "At ₹0 — investment recovered.",
            "Above ₹0 — cash generated above initial investment.",
          ].join("\n"),
        },
      ],
      guideLinks: [{ label: "Investment Recovery", href: guideHref("payback") }],
    };
  }

  let status: string;
  if (positionNum < 0) {
    status = `Below ₹0 — you still need to recover ${formatINR(Math.abs(positionNum))}.`;
  } else if (positionNum === 0) {
    status = "At ₹0 — investment recovered.";
  } else {
    status = `Above ₹0 — ${formatINR(positionNum)} generated above initial investment.`;
  }

  const paybackText =
    payback.paybackMonth != null
      ? `Payback month: Month ${payback.paybackMonth}.`
      : health.investmentRecoveredMonth != null
        ? `Recovery crosses zero in Month ${health.investmentRecoveredMonth}.`
        : "Payback is not reached within the forecast horizon with current assumptions.";

  return {
    sections: [
      {
        title: "INVESTMENT RECOVERY",
        body: [
          `Payback investment base: ${formatINR(cashFlow.initialInvestment)}`,
          `Current recovery position: ${formatINR(positionNum)}`,
          status,
          paybackText,
        ].join("\n"),
      },
    ],
    guideLinks: [{ label: "Payback", href: guideHref("payback") }],
  };
}

function handleBankCash(ctx: AskOwnedContext): OwnedAnswer {
  const health = ctx.model.cashFlow.cashHealth;
  const reconciles = health.minimumTotalFundingRequired
    .minus(health.totalPlannedFunding.plus(health.fundingGap))
    .abs()
    .lte(0.01);

  const lines = [
    `Founder funding planned: ${formatINR(health.totalPlannedFunding)}`,
    `Lowest bank cash: ${formatINR(health.lowestBankCash)} (month ${health.lowestBankCashMonth})`,
    `Funding gap: ${formatINR(health.fundingGap)}`,
    `Minimum total funding required: ${formatINR(health.minimumTotalFundingRequired)}`,
  ];
  if (health.bankCashPositiveMonth != null) {
    lines.push(`Bank cash positive from: Month ${health.bankCashPositiveMonth}`);
  }
  if (!reconciles) {
    lines.push("", "These values do not appear to reconcile. This should be checked.");
  }

  return {
    sections: [{ title: "BANK CASH & FUNDING", body: lines.join("\n") }],
    guideLinks: [{ label: "Cash Flow", href: guideHref("cash-flow") }],
  };
}

function handleSalesTarget(question: string, ctx: AskOwnedContext): OwnedAnswer {
  const analysis = runSalesTargetAnalysis(ctx.assumptions);
  const clients = analysis.suggestedMix.clients;

  if (/client/i.test(question)) {
    return {
      sections: [
        {
          title: "CLIENT REQUIREMENT",
          body: [
            `Target profit: ${formatINR(analysis.targetProfit)} (Month ${analysis.targetMonth})`,
            `Month ${analysis.targetMonth} forecast profit: ${formatINR(analysis.forecastProfit)}`,
            `Gap to target: ${formatINR(analysis.profitGap)}`,
            "",
            `Estimated new paying clients needed this month: ${clients.newCustomersNeededThisMonth.toFixed(0)}`,
            `Estimated unique active clients: ${clients.estimatedUniqueActiveClients.toFixed(0)}`,
          ].join("\n"),
        },
      ],
      guideLinks: [{ label: "Sales & Client Target", href: guideHref("sales-client-target") }],
    };
  }

  return handleProfitComparison(question, ctx);
}

function handleBreakEven(ctx: AskOwnedContext): OwnedAnswer {
  const be = ctx.model.breakEven.contributionBreakEven;
  return {
    sections: [
      {
        title: "BREAK-EVEN",
        body: [
          `Break-even occupancy: ${formatPercent(be.breakEvenOccupancyPct)}`,
          `At target occupancy (${formatPercent(ctx.assumptions.projectedBookedOccupancyPct, 0)}), planning net profit is ${formatINR(ctx.model.pl.netProfit)}.`,
        ].join("\n"),
      },
    ],
    guideLinks: [{ label: "Break-even", href: guideHref("break-even") }],
  };
}

function handleCapacity(question: string, ctx: AskOwnedContext): OwnedAnswer {
  if (isClassCountQuestion(question)) {
    return answerClassCountQuestion(question, ctx.assumptions, ctx.model, ctx.occupancyHint);
  }
  const cap = ctx.model.capacity;
  return {
    sections: [
      {
        title: "CAPACITY",
        body: [
          `Reformers: ${ctx.assumptions.reformers}`,
          `Monthly available reformer spots: ${cap.monthlyAvailableSeats.toFixed(0)}`,
          `Occupied spots at planned occupancy: ${cap.occupiedSeatsMonthly.toFixed(0)}`,
          `Attended seats (after no-shows): ${cap.attendedSeatsMonthly.toFixed(0)}`,
        ].join("\n"),
      },
    ],
    guideLinks: [{ label: "Capacity", href: guideHref("capacity") }],
  };
}

function handleOccupancy(question: string, ctx: AskOwnedContext): OwnedAnswer {
  if (isClassCountQuestion(question)) {
    return answerClassCountQuestion(question, ctx.assumptions, ctx.model, ctx.occupancyHint);
  }
  const entry = searchDictionary("occupancy")[0];
  return {
    sections: [
      {
        title: "OCCUPANCY",
        body: [
          entry?.definition ??
            "Occupancy is the share of available reformer spots that are booked.",
          "",
          `Your planned booked occupancy: ${formatPercent(ctx.assumptions.projectedBookedOccupancyPct, 0)}`,
          `Actual occupied spots this month: ${ctx.model.capacity.occupiedSeatsMonthly.toFixed(0)} of ${ctx.model.capacity.monthlyAvailableSeats.toFixed(0)}`,
        ].join("\n"),
      },
    ],
    guideLinks: [{ label: "Capacity", href: guideHref("capacity") }],
  };
}

function handleExplainMetric(
  question: string,
  ctx: AskOwnedContext,
  pageTitle: string
): OwnedAnswer {
  if (/what\s+does\s+this\s+mean|what\s+is\s+this/i.test(question)) {
    const pageGuide = pageTitle;
    if (ctx.pathname.includes("/payback")) return handleInvestmentRecovery(question, ctx);
    if (ctx.pathname.includes("/sales-target")) return handleProfitComparison(question, ctx);
    if (ctx.pathname.includes("/cash-flow")) return handleProfitVsCash(ctx);
    return {
      sections: [
        {
          title: "WHAT THIS MEANS",
          body: `You're on ${pageGuide}. Ask about a specific number, or try one of the suggested questions.`,
        },
      ],
    };
  }

  const trace = getMetricTraceForPage(ctx);
  if (trace) {
    return {
      sections: [{ title: "WHERE THIS NUMBER COMES FROM", body: renderTraceBody(trace) }],
    };
  }

  return handleGuideSearch(question, ctx);
}

function handleExplainTerm(question: string, ctx: AskOwnedContext): OwnedAnswer {
  const q = question.toLowerCase();
  for (const [key, ans] of Object.entries(DIFFERENCE_ANSWERS)) {
    if (q.includes(key.replace(/ and /g, " and "))) {
      return {
        sections: [{ title: ans.title, body: ans.body }],
        guideLinks: ans.guideId ? [{ label: ans.title, href: guideHref(ans.guideId) }] : undefined,
      };
    }
  }
  if (/difference between sales and bookings/i.test(q)) {
    const a = DIFFERENCE_ANSWERS["sales and bookings"]!;
    return {
      sections: [{ title: a.title, body: a.body }],
      guideLinks: [{ label: a.title, href: guideHref(a.guideId!) }],
    };
  }
  if (/clients and transactions/i.test(q)) {
    const a = DIFFERENCE_ANSWERS["clients and transactions"]!;
    return {
      sections: [{ title: a.title, body: a.body }],
      guideLinks: [{ label: a.title, href: guideHref(a.guideId!) }],
    };
  }
  if (/credits sold and credits used/i.test(q)) {
    const a = DIFFERENCE_ANSWERS["credits sold and credits used"]!;
    return {
      sections: [{ title: a.title, body: a.body }],
      guideLinks: [{ label: a.title, href: guideHref(a.guideId!) }],
    };
  }

  const termQuery = extractTermQuery(question) ?? question;
  const dict = searchDictionary(termQuery);
  if (dict.length > 0) {
    const e = dict[0]!;
    const parts = [e.definition];
    if (e.formula) parts.push("", `Formula: ${e.formula}`);
    if (e.example) parts.push("", `Example: ${e.example}`);
    if (e.notTheSameAs) parts.push("", `Not the same as: ${e.notTheSameAs}`);
    const guideId = TERM_GUIDE_MAP[termQuery.toLowerCase()];
    return {
      sections: [{ title: e.term, body: parts.join("\n") }],
      guideLinks: guideId ? [{ label: e.term, href: guideHref(guideId) }] : undefined,
    };
  }

  return handleGuideSearch(question, ctx);
}

function handleGuideSearch(question: string, ctx: AskOwnedContext): OwnedAnswer {
  const results = searchOwnedGuide(question, 2);
  if (results.length === 0) {
    return handleUnknown(question, ctx);
  }
  const top = results[0]!;
  return {
    sections: [
      {
        title: top.section.title,
        body: top.snippet || top.section.body[0] || "",
      },
    ],
    guideLinks: [{ label: top.section.title, href: guideHref(top.section.id) }],
  };
}

function handleUnknown(question: string, ctx: AskOwnedContext): OwnedAnswer {
  const page = getOwnedPageContext(ctx.pathname);
  return {
    sections: [
      {
        body: [
          "I don't have a reliable local answer for that yet.",
          "",
          "Try:",
          "• Search the Guide",
          "• View a relevant section",
          "• One of the suggested questions for this page",
        ].join("\n"),
      },
    ],
    guideLinks: page.guideSectionIds.slice(0, 2).map((id) => ({
      label: "Guide section",
      href: guideHref(id),
    })),
    suggestedFollowUps: page.suggestedQuestions.slice(0, 3),
    isFallback: true,
  };
}

export { classifyOwnedQuestion };
