/**
 * Stress test suite — audits Ask OWNED math coverage.
 * Each case must NOT fall back to "don't have a reliable local answer".
 */
import { describe, it, expect } from "vitest";
import { WEEKS_PER_MONTH } from "@/lib/finance/decimal";
import { createSampleAssumptions } from "@/lib/finance/sample-data";
import { runFinanceModel } from "@/lib/finance/run-model";
import { formatINR } from "@/lib/format/currency";
import { answerOwnedQuestion } from "../answer";
import { computeClassCountAtOccupancy } from "../capacity-answers";
import type { CalculationSnapshot } from "../calculation-snapshot";
import type { AskOwnedContext } from "../types";

function ctx(snapshot?: CalculationSnapshot, occupancyHint?: number): AskOwnedContext {
  const assumptions = createSampleAssumptions();
  const model = runFinanceModel(assumptions);
  return {
    pathname: "/math/capacity",
    assumptions,
    model,
    occupancyHint,
    calculationSnapshot: snapshot,
  };
}

function expectMathAnswer(question: string, c: AskOwnedContext, mustContain: string[]) {
  const ans = answerOwnedQuestion(question, c);
  expect(ans.isFallback, `Fallback for: "${question}"`).toBeFalsy();
  const body = ans.sections.map((s) => s.body).join("\n").toLowerCase();
  for (const fragment of mustContain) {
    expect(body, `"${question}" missing "${fragment}"`).toContain(fragment.toLowerCase());
  }
  return ans;
}

describe("Ask OWNED math stress test", () => {
  const assumptions = createSampleAssumptions();
  const model = runFinanceModel(assumptions);
  const base = ctx();

  describe("class count & occupancy", () => {
    it("75% occupancy full 3/3 classes per month", () => {
      const result = computeClassCountAtOccupancy(assumptions, model, 75, 3);
      const ans = expectMathAnswer(
        "at 75% occupancy how many classes a month need to be completely booked 3/3",
        base,
        ["equivalent fully-booked", "per month", result.equivalentFullClasses.toFixed(0)]
      );
      expect(ans.calculationSnapshot?.kind).toBe("class_count");
    });

    it("follow-up per week from snapshot", () => {
      const result = computeClassCountAtOccupancy(assumptions, model, 75, 3);
      const monthly = result.equivalentFullClasses.toNumber();
      const weekly = monthly / WEEKS_PER_MONTH.toNumber();
      const snap: CalculationSnapshot = {
        kind: "class_count",
        label: "Equivalent full 3/3 classes",
        primaryValue: monthly,
        primaryUnit: "classes",
        basis: "monthly",
        occupancyPct: 75,
        classSize: 3,
      };
      expectMathAnswer("how many classes is that per week?", ctx(snap, 75), [
        "per week",
        weekly.toFixed(1),
      ]);
    });

    it("per day conversion", () => {
      const result = computeClassCountAtOccupancy(assumptions, model, 60, 3);
      const monthly = result.equivalentFullClasses.toNumber();
      const daily = monthly / (WEEKS_PER_MONTH.toNumber() * 7);
      const snap: CalculationSnapshot = {
        kind: "class_count",
        label: "Classes",
        primaryValue: monthly,
        primaryUnit: "classes",
        basis: "monthly",
      };
      expectMathAnswer("what is that per day?", ctx(snap), ["per day", daily.toFixed(1)]);
    });

    it("occupied spots at 80% occupancy", () => {
      const result = computeClassCountAtOccupancy(assumptions, model, 80, 3);
      expectMathAnswer("how many occupied spots at 80% occupancy?", base, [
        "occupied spots",
        result.occupiedSpots.toFixed(0),
      ]);
    });
  });

  describe("model metrics", () => {
    it("net profit", () => {
      expectMathAnswer("what is my net profit?", base, [
        "planning net profit",
        formatINR(model.pl.netProfit).toLowerCase(),
      ]);
    });

    it("monthly revenue", () => {
      expectMathAnswer("how much is my monthly revenue?", base, [
        "net sales",
        formatINR(model.revenue.netRevenue).toLowerCase(),
      ]);
    });

    it("rent", () => {
      expectMathAnswer("how much is rent?", base, ["rent", formatINR(assumptions.rent).toLowerCase()]);
    });

    it("contribution per spot", () => {
      expectMathAnswer("what is contribution per spot?", base, [
        "contribution per occupied spot",
        formatINR(model.unitEconomics.perSeat.contributionMarginPerSeat).toLowerCase(),
      ]);
    });

    it("break-even occupancy", () => {
      expectMathAnswer("what is break-even occupancy?", base, ["break-even occupancy"]);
    });

    it("weekly class sessions", () => {
      expectMathAnswer("how many classes per week?", base, [
        "weekly class sessions",
        model.capacity.weeklyClasses.toFixed(0),
      ]);
    });

    it("monthly reformer spots", () => {
      expectMathAnswer("how many monthly reformer spots?", base, [
        "monthly available",
        model.capacity.monthlyAvailableSeats.toFixed(0),
      ]);
    });

    it("funding gap", () => {
      expectMathAnswer("what is the funding gap?", base, [
        "funding gap",
        formatINR(model.cashFlow.cashHealth.fundingGap).toLowerCase(),
      ]);
    });
  });

  describe("derived ratios", () => {
    it("rent per class", () => {
      const monthlyClasses = model.capacity.weeklyClasses.times(WEEKS_PER_MONTH).toNumber();
      const perClass = assumptions.rent / monthlyClasses;
      expectMathAnswer("what is rent per class?", base, [
        "rent per class",
        formatINR(perClass).toLowerCase(),
      ]);
    });

    it("contribution per full class", () => {
      const perClass = model.unitEconomics.perSeat.contributionMarginPerSeat.times(
        assumptions.maxGroupClassSize
      );
      expectMathAnswer("contribution per full class", base, [
        "contribution per full",
        formatINR(perClass).toLowerCase(),
      ]);
    });

    it("profit per class session", () => {
      const monthlyClasses = model.capacity.weeklyClasses.times(WEEKS_PER_MONTH).toNumber();
      const perClass = model.pl.netProfit.toNumber() / monthlyClasses;
      expectMathAnswer("profit per class", base, [formatINR(perClass).toLowerCase()]);
    });
  });

  describe("period conversions on metrics", () => {
    it("net profit per week", () => {
      const weekly = model.pl.netProfit.toNumber() / WEEKS_PER_MONTH.toNumber();
      expectMathAnswer("what is my net profit per week?", base, [
        "per week",
        formatINR(weekly).toLowerCase(),
      ]);
    });

    it("annual profit", () => {
      const annual = model.pl.netProfit.times(12);
      expectMathAnswer("what is my annual profit?", base, [
        "per year",
        formatINR(annual).toLowerCase(),
      ]);
    });
  });

  describe("capacity basics", () => {
    it("reformer count", () => {
      expectMathAnswer("how many reformers do I have?", base, [
        assumptions.reformers.toString(),
      ]);
    });

    it("classes per day", () => {
      expectMathAnswer("how many classes per day?", base, [
        `${assumptions.classesPerDay} class sessions per day`,
      ]);
    });
  });

  describe("conversation flow simulation", () => {
    it("class count then weekly follow-up", () => {
      const q1 = "at 75% occupancy how many classes completely booked 3/3";
      const ans1 = answerOwnedQuestion(q1, base);
      expect(ans1.isFallback).toBeFalsy();
      expect(ans1.calculationSnapshot).toBeDefined();

      const ans2 = answerOwnedQuestion("how many classes is that per week?", {
        ...base,
        occupancyHint: 75,
        classSizeHint: 3,
        calculationSnapshot: ans1.calculationSnapshot,
      });
      expect(ans2.isFallback).toBeFalsy();
      expect(ans2.sections[0]?.body).toContain("per week");
    });
  });

  describe("still handles non-math", () => {
    it("profit vs cash", () => {
      expectMathAnswer("why is profit different from cash", ctx(undefined), ["depreciation"]);
    });

    it("what-if private", () => {
      const ans = answerOwnedQuestion("what if private is 4500", base);
      expect(ans.whatIfApply).toBeDefined();
    });
  });
});

describe("Ask OWNED math audit summary", () => {
  it("reports zero fallbacks for core math question bank", () => {
    const cases = [
      "at 75% occupancy how many classes completely booked 3/3",
      "how many classes is that per week?",
      "what is my net profit?",
      "how much is rent per class?",
      "how many occupied spots at 80% occupancy?",
      "what is break-even occupancy?",
      "what is my annual profit?",
      "how many classes per week?",
    ];
    const assumptions = createSampleAssumptions();
    const model = runFinanceModel(assumptions);
    const snap = answerOwnedQuestion(
      "at 75% occupancy how many classes completely booked 3/3",
      ctx()
    ).calculationSnapshot;

    const results = cases.map((q) => {
      const c: AskOwnedContext = {
        pathname: "/math/capacity",
        assumptions,
        model,
        occupancyHint: 75,
        calculationSnapshot: q.includes("that") ? snap : undefined,
      };
      return { q, fallback: answerOwnedQuestion(q, c).isFallback === true };
    });
    const failed = results.filter((r) => r.fallback);
    expect(failed, `Failed: ${failed.map((f) => f.q).join(", ")}`).toHaveLength(0);
  });
});
