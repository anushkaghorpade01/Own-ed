import { describe, it, expect } from "vitest";
import { classifyOwnedQuestion } from "../classify";
import { parseIndianAmount } from "../parse-indian-number";
import { getOwnedPageContext } from "../page-context";
import { searchOwnedGuide } from "../guide-search";
import {
  parseWhatIfQuestion,
  buildWhatIfPatch,
  runOwnedWhatIf,
} from "../what-if";
import {
  answerOwnedQuestion,
  getBlendedNetSalesTrace,
  runOwnedHealthChecks,
} from "../index";
import { createSampleAssumptions } from "@/lib/finance/sample-data";
import { runFinanceModel } from "@/lib/finance/run-model";
import { extractTermQuery } from "../terms";

describe("classifyOwnedQuestion", () => {
  it("classifies profit comparison", () => {
    expect(classifyOwnedQuestion("why is profit different", "/math/pl")).toBe(
      "COMPARE_PROFIT_VIEWS"
    );
  });

  it("classifies what-if", () => {
    expect(classifyOwnedQuestion("what if rent is 2 lakh", "/math/pl")).toBe("WHAT_IF");
  });

  it("classifies investment recovery", () => {
    expect(classifyOwnedQuestion("when do I recover my investment", "/math/payback")).toBe(
      "INVESTMENT_RECOVERY"
    );
  });

  it("classifies explain term", () => {
    expect(classifyOwnedQuestion("what is net sales", "/math/pl")).toBe("EXPLAIN_TERM");
  });

  it("classifies class count at occupancy", () => {
    expect(
      classifyOwnedQuestion("at 75% occupancy how many classes completely booked 3/3", "/math/capacity")
    ).toBe("CAPACITY");
  });
});

describe("parseIndianAmount", () => {
  it("parses lakh", () => {
    expect(parseIndianAmount("2 lakh")).toBe(200_000);
    expect(parseIndianAmount("2.5L")).toBe(250_000);
  });

  it("parses k and percent", () => {
    expect(parseIndianAmount("4500")).toBe(4500);
    expect(parseIndianAmount("80%")).toBe(80);
    expect(parseIndianAmount("50k")).toBe(50_000);
  });
});

describe("what-if parser", () => {
  it("parses rent in lakh", () => {
    const p = parseWhatIfQuestion("what if rent is 2 lakh");
    expect(p?.variable).toBe("rent");
    expect(p?.value).toBe(200_000);
  });

  it("parses private price", () => {
    const p = parseWhatIfQuestion("what if private is 4500");
    expect(p?.variable).toBe("private");
    expect(p?.value).toBe(4500);
  });

  it("parses occupancy", () => {
    const p = parseWhatIfQuestion("what if occupancy is 80%");
    expect(p?.variable).toBe("occupancy");
    expect(p?.value).toBe(80);
  });
});

describe("what-if does not mutate assumptions", () => {
  it("preview only until apply", () => {
    const base = createSampleAssumptions();
    const rentBefore = base.rent;
    const parsed = parseWhatIfQuestion("what if rent is 200000")!;
    const result = runOwnedWhatIf(base, parsed);
    expect(result).not.toBeNull();
    expect(base.rent).toBe(rentBefore);
    expect(result!.whatIfNetProfit).not.toBe(result!.baseNetProfit);
  });

  it("buildWhatIfPatch updates rent", () => {
    const base = createSampleAssumptions();
    const parsed = parseWhatIfQuestion("what if rent is 200000")!;
    const patch = buildWhatIfPatch(base, parsed);
    expect(patch.rent).toBe(200_000);
  });
});

describe("page context", () => {
  it("returns P&L suggestions", () => {
    const ctx = getOwnedPageContext("/math/pl");
    expect(ctx.title).toBe("Monthly P&L");
    expect(ctx.suggestedQuestions.length).toBeGreaterThan(0);
  });
});

describe("guide search", () => {
  it("finds profit views", () => {
    const hits = searchOwnedGuide("different profit numbers");
    expect(hits.length).toBeGreaterThan(0);
  });

  it("finds ask owned section", () => {
    const hits = searchOwnedGuide("ask owned");
    expect(hits.some((h) => h.section.id === "ask-owned")).toBe(true);
  });
});

describe("answerOwnedQuestion", () => {
  const assumptions = createSampleAssumptions();
  const model = runFinanceModel(assumptions);
  const ctx = { pathname: "/math/pl", assumptions, model };

  it("answers net sales from model", () => {
    const ans = answerOwnedQuestion("what is net sales", ctx);
    expect(ans.sections[0]?.body.toLowerCase()).toContain("net sales");
    expect(ans.isFallback).toBeFalsy();
  });

  it("compares profit views", () => {
    const ans = answerOwnedQuestion("why is month 8 profit lower", {
      ...ctx,
      pathname: "/math/sales-target",
    });
    expect(ans.sections[0]?.body).toContain("Month 8");
    expect(ans.sections[0]?.body).toContain("Steady-state");
  });

  it("explains investment recovery", () => {
    const ans = answerOwnedQuestion("when do I recover my investment", {
      ...ctx,
      pathname: "/math/payback",
    });
    expect(ans.sections[0]?.body.toLowerCase()).toMatch(/recovery|payback/i);
  });

  it("explains bank cash", () => {
    const ans = answerOwnedQuestion("how much funding do I need", {
      ...ctx,
      pathname: "/math/cash-flow",
    });
    expect(ans.sections[0]?.body).toContain("Funding gap");
  });

  it("runs private what-if", () => {
    const ans = answerOwnedQuestion("what if private is 4500", ctx);
    expect(ans.whatIfApply).toBeDefined();
    expect(ans.sections[0]?.body).toContain("What-if planning net profit");
  });

  it("shows calculation trace", () => {
    const ans = answerOwnedQuestion("how is this number calculated", {
      ...ctx,
      pathname: "/math/unit-economics",
    });
    expect(ans.sections[0]?.title).toContain("WHERE");
  });

  it("falls back for unknown", () => {
    const ans = answerOwnedQuestion("quantum flux capacitor settings", ctx);
    expect(ans.isFallback).toBe(true);
    expect(ans.sections[0]?.body).toContain("don't have a reliable local answer");
  });

  it("answers class count at 75% occupancy", () => {
    const ans = answerOwnedQuestion(
      "at 75% occupancy how many classes a month need to be completely booked 3/3",
      { ...ctx, pathname: "/math/capacity" }
    );
    expect(ans.sections[0]?.title).toBe("CLASS COUNT");
    expect(ans.sections[0]?.body).toContain("Equivalent fully-booked 3/3 classes");
    expect(ans.sections[0]?.body).toMatch(/\d+/);
    expect(ans.sections[0]?.body).not.toContain("Contribution from one class");
  });

  it("answers follow-up class count", () => {
    const ans = answerOwnedQuestion("how many classes is that (class count)", {
      ...ctx,
      pathname: "/math/capacity",
    });
    expect(ans.sections[0]?.title).toBe("CLASS COUNT");
    expect(ans.sections[0]?.body).toContain("Monthly scheduled class sessions");
  });

  it("profit vs cash", () => {
    const ans = answerOwnedQuestion("why is profit different from cash", ctx);
    expect(ans.sections[0]?.body).toContain("Depreciation");
  });

  it("investment not in month profit", () => {
    const ans = answerOwnedQuestion("does month 8 profit include the initial investment", ctx);
    expect(ans.sections[0]?.body.toLowerCase()).toContain("no");
  });
});

describe("metric trace", () => {
  it("blended net sales trace sums rows", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const trace = getBlendedNetSalesTrace(model);
    expect(trace.inputs.length).toBeGreaterThan(0);
    expect(trace.result).toBeCloseTo(
      model.revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot.toNumber(),
      0
    );
  });
});

describe("health checks", () => {
  it("passes on sample model", () => {
    const model = runFinanceModel(createSampleAssumptions());
    const checks = runOwnedHealthChecks(model);
    expect(checks.every((c) => c.passed)).toBe(true);
  });

  it("fails when mix invalid", () => {
    const base = createSampleAssumptions();
    const broken = {
      ...base,
      products: base.products.map((p) => ({ ...p, serviceDemandPct: 0 })),
    };
    const model = runFinanceModel(broken);
    const checks = runOwnedHealthChecks(model);
    expect(checks.some((c) => !c.passed)).toBe(true);
  });
});

describe("class count parsing", () => {
  it("parses occupancy and class size", async () => {
    const { parseOccupancyFromQuestion, parseFullClassSize, computeClassCountAtOccupancy } =
      await import("../capacity-answers");
    expect(parseOccupancyFromQuestion("at 75% occupancy")).toBe(75);
    expect(parseFullClassSize("completely booked 3/3", 3)).toBe(3);
    const assumptions = createSampleAssumptions();
    const model = runFinanceModel(assumptions);
    const result = computeClassCountAtOccupancy(assumptions, model, 75, 3);
    expect(result.occupiedSpots.toNumber()).toBeCloseTo(
      model.capacity.monthlyAvailableSeats.times(0.75).toNumber(),
      0
    );
    expect(result.equivalentFullClasses.toNumber()).toBeCloseTo(
      result.occupiedSpots.dividedBy(3).toNumber(),
      0
    );
  });
});

describe("term aliases", () => {
  it("extracts term from what is", () => {
    expect(extractTermQuery("What is occupancy?")).toBe("occupancy");
  });
});
