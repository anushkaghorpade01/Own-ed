import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "@/lib/finance/sample-data";
import { runFinanceModel } from "@/lib/finance/run-model";
import { parseAmountFromQuestion, isFundingBudgetQuestion } from "../parse-amount-from-question";
import { solveFundingBudget, scaleOperatingExpenses } from "../funding-budget";
import { answerFundingBudgetQuestion } from "../funding-budget-answer";
import { answerOwnedQuestion } from "../answer";

describe("parseAmountFromQuestion", () => {
  it("parses lakh in sentence", () => {
    expect(parseAmountFromQuestion("I only have 25 lakhs to invest")).toBe(2_500_000);
  });

  it("detects funding budget questions", () => {
    expect(
      isFundingBudgetQuestion(
        "if I only have 25 lakhs to invest how much should I reduce expenses to have enough cash"
      )
    ).toBe(true);
  });
});

describe("solveFundingBudget", () => {
  const assumptions = createSampleAssumptions();

  it("reports no cut when budget already sufficient", () => {
    const model = runFinanceModel(assumptions);
    const required = model.cashFlow.cashHealth.minimumTotalFundingRequired.toNumber();
    const result = solveFundingBudget(assumptions, required, true, 1);
    expect(result.baselineGap).toBeLessThanOrEqual(0);
    expect(result.requiredMonthlyCut).toBe(0);
  });

  it("reports feasible cut or honest infeasible for 25L budget", () => {
    const result = solveFundingBudget(assumptions, 2_500_000, true, 1);
    if (result.feasible && result.baselineGap > 0) {
      expect(result.requiredMonthlyCut).toBeGreaterThan(0);
      expect(result.solvedModel!.cashFlow.cashHealth.fundingGap.toNumber()).toBeLessThanOrEqual(0);
    } else if (!result.feasible) {
      expect(result.baselineGap).toBeGreaterThan(0);
    }
  });

  it("scaleOperatingExpenses reduces rent", () => {
    const scaled = scaleOperatingExpenses(assumptions, 0.5);
    expect(scaled.rent).toBe(Math.round(assumptions.rent * 0.5));
  });
});

describe("answerFundingBudgetQuestion", () => {
  it("answers 25 lakh expense reduction question", () => {
    const assumptions = createSampleAssumptions();
    const model = runFinanceModel(assumptions);
    const ans = answerOwnedQuestion(
      "If I only have 25 lakhs to invest, by how much should I reduce my expenses to make sure that is enough to get started and leave enough cash for operating expenses until month 1 revenue",
      { pathname: "/math/cash-flow", assumptions, model }
    );
    expect(ans.isFallback).toBeFalsy();
    expect(ans.sections[0]?.title).toBe("FUNDING BUDGET");
    expect(ans.sections[0]?.body.toLowerCase()).toMatch(/funding gap|good news|expense reduction/);
  });

  it("direct handler returns budget answer", () => {
    const assumptions = createSampleAssumptions();
    const model = runFinanceModel(assumptions);
    const ans = answerFundingBudgetQuestion(
      "only have 25 lakh how much reduce expenses for enough cash",
      { pathname: "/math/cash-flow", assumptions, model }
    );
    expect(ans).not.toBeNull();
    expect(ans!.sections[0]?.body).toContain("25,00,000");
  });
});
