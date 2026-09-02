import { formatINR } from "@/lib/format/currency";
import type { AskOwnedContext, OwnedAnswer } from "./types";
import { guideHref } from "./guide-search";
import {
  isFundingBudgetQuestion,
  isOnlyFounderFunding,
  parseAmountFromQuestion,
  parseRunwayTargetMonth,
} from "./parse-amount-from-question";
import { scaleOperatingExpenses, solveFundingBudget } from "./funding-budget";

export function answerFundingBudgetQuestion(
  question: string,
  ctx: AskOwnedContext
): OwnedAnswer | null {
  if (!isFundingBudgetQuestion(question)) return null;

  const budget = parseAmountFromQuestion(question);
  if (budget == null || budget <= 0) return null;

  const onlyFounder = isOnlyFounderFunding(question);
  const targetMonth = parseRunwayTargetMonth(question, 1);
  const result = solveFundingBudget(ctx.assumptions, budget, onlyFounder, targetMonth);

  const lines: string[] = [
    `Budget scenario: ${formatINR(budget)} founder funding${onlyFounder ? " only (no loan assumed)" : ""}.`,
    "",
    "CURRENT PLAN AT THIS BUDGET",
    `Funding gap: ${formatINR(result.baselineGap)}`,
    `Lowest bank cash: ${formatINR(result.baselineLowestCash)}`,
    `Minimum total funding OWNED calculates: ${formatINR(result.baselineMinRequired)}`,
  ];

  if (result.baselineGap <= 0) {
    lines.push(
      "",
      "GOOD NEWS",
      `Your plan already fits within ${formatINR(budget)} at current operating expenses.`,
      result.bankCashPositiveMonth != null
        ? `Bank cash stays non-negative from month ${result.bankCashPositiveMonth}.`
        : "Review Cash Flow for month-by-month bank balance.",
      result.operatingCashPositiveMonth != null
        ? `Operating cash turns positive in month ${result.operatingCashPositiveMonth}.`
        : ""
    );
  } else if (!result.feasible) {
    lines.push(
      "",
      "NOT FEASIBLE WITH EXPENSE CUTS ALONE",
      `Even if all operating expenses were reduced to ₹0 in the model, ${formatINR(budget)} is not enough to keep bank cash non-negative.`,
      "You may need more funding, lower launch investment, higher early revenue, or a combination."
    );
  } else {
    lines.push(
      "",
      "EXPENSE REDUCTION NEEDED",
      `Reduce total monthly operating expenses by about ${formatINR(result.requiredMonthlyCut)} (${result.cutPct.toFixed(0)}%) from ${formatINR(result.currentMonthlyOpex)} to ${formatINR(result.requiredMonthlyOpexAfter)}.`,
      "This assumes proportional cuts across rent, payroll, utilities, marketing, and other operating lines in Assumptions.",
      "",
      "AFTER CUTS (MODEL PREVIEW)",
      `Funding gap: ${formatINR(result.solvedModel!.cashFlow.cashHealth.fundingGap.toNumber())}`,
      `Lowest bank cash: ${formatINR(result.solvedModel!.cashFlow.cashHealth.lowestBankCash.toNumber())}`,
      result.bankCashPositiveMonth != null
        ? `Bank cash non-negative from month ${result.bankCashPositiveMonth}.`
        : "",
      result.operatingCashPositiveMonth != null
        ? `Operating cash positive from month ${result.operatingCashPositiveMonth}.`
        : ""
    );
  }

  lines.push(
    "",
    "Note: Uses OWNED's bank cash engine — launch investment, working capital, ramp-up, and operating cash timing. Saved assumptions are not changed until you apply."
  );

  const cutScale = result.requiredScale ?? 1;
  const patch = scaleOperatingExpenses(
    {
      ...ctx.assumptions,
      founderEquity: budget,
      loanAmount: onlyFounder ? 0 : ctx.assumptions.loanAmount,
      additionalFundingEvents: onlyFounder
        ? []
        : ctx.assumptions.additionalFundingEvents ?? [],
    },
    cutScale
  );

  return {
    sections: [{ title: "FUNDING BUDGET", body: lines.filter(Boolean).join("\n") }],
    guideLinks: [{ label: "Cash Flow", href: guideHref("cash-flow") }],
    whatIfApply:
      result.feasible && result.requiredMonthlyCut > 0
        ? { label: "Apply expense reduction preview", patch }
        : undefined,
    calculationSnapshot: {
      kind: "funding",
      label: "Funding budget",
      primaryValue: budget,
      primaryUnit: "INR",
      basis: "absolute",
      extras: {
        fundingGap: result.baselineGap,
        requiredMonthlyCut: result.requiredMonthlyCut,
      },
    },
  };
}
