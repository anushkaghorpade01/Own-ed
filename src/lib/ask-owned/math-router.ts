import { WEEKS_PER_MONTH } from "@/lib/finance/decimal";
import type { CalculationSnapshot } from "./calculation-snapshot";
import type { AskOwnedContext, OwnedAnswer } from "./types";
import {
  parseOccupancyFromQuestion,
  parseFullClassSize,
  computeClassCountAtOccupancy,
  isClassCountQuestion,
} from "./capacity-answers";
import {
  isPeriodConversionQuestion,
  parseTargetPeriod,
  convertValue,
  formatPeriodValue,
  matchModelMetric,
  isMetricQuantityQuestion,
  isDerivedRatioQuestion,
  isScheduleClassQuestion,
  MODEL_METRICS,
  formatMetricAnswer,
} from "./model-metrics";
import { formatINR, formatPercent } from "@/lib/format/currency";
import { guideHref } from "./guide-search";
import { answerFundingBudgetQuestion } from "./funding-budget-answer";
import { answerCalculationQuestion, isCalculationQuestion } from "./calculation-answers";

function snapshotFromClassCount(
  result: ReturnType<typeof computeClassCountAtOccupancy>
): CalculationSnapshot {
  return {
    kind: "class_count",
    label: `Equivalent full ${result.classSize}/${result.classSize} classes`,
    primaryValue: result.equivalentFullClasses.toNumber(),
    primaryUnit: "classes",
    basis: "monthly",
    occupancyPct: result.occupancyPct,
    classSize: result.classSize,
    extras: {
      occupiedSpots: result.occupiedSpots.toNumber(),
      monthlyClassSessions: result.monthlyClassSessions.toNumber(),
      monthlyAvailableSpots: result.monthlyAvailableSpots.toNumber(),
      weeklyClassSessions: result.monthlyClassSessions.dividedBy(WEEKS_PER_MONTH).toNumber(),
    },
  };
}

function answerPeriodConversion(
  question: string,
  ctx: AskOwnedContext
): OwnedAnswer | null {
  if (!isPeriodConversionQuestion(question)) return null;

  const target = parseTargetPeriod(question);
  if (!target) return null;

  const snap = ctx.calculationSnapshot;
  if (!snap) {
    if (/class/i.test(question) && (ctx.occupancyHint != null || ctx.classSizeHint != null)) {
      const occ = ctx.occupancyHint ?? ctx.assumptions.projectedBookedOccupancyPct;
      const size = ctx.classSizeHint ?? ctx.assumptions.maxGroupClassSize;
      const result = computeClassCountAtOccupancy(ctx.assumptions, ctx.model, occ, size);
      const converted = convertValue(result.equivalentFullClasses.toNumber(), "monthly", target);
      return {
        sections: [
          {
            title: "CLASS COUNT",
            body: [
              `Equivalent full ${size}/${size} classes at ${formatPercent(occ, 0)} occupancy:`,
              `${result.equivalentFullClasses.toFixed(0)} per month`,
              `→ ${formatPeriodValue(converted, "classes", target)}`,
              "",
              `Calculation: ${result.equivalentFullClasses.toFixed(0)} ÷ ${WEEKS_PER_MONTH.toFixed(4)} weeks/month ≈ ${converted.toFixed(1)}`,
            ].join("\n"),
          },
        ],
        calculationSnapshot: snapshotFromClassCount(result),
      };
    }
    return null;
  }

  const basis =
    snap.basis === "per_unit" || snap.basis === "absolute" ? "absolute" : snap.basis;
  const converted = convertValue(snap.primaryValue, basis, target);
  const isCurrency = snap.primaryUnit === "INR";

  const lines = [
    `Converting ${snap.label}:`,
    `${snap.primaryValue.toFixed(snap.primaryUnit === "classes" ? 0 : 2)} ${snap.primaryUnit}${snap.basis === "monthly" ? " per month" : ""}`,
    `→ ${formatPeriodValue(converted, snap.primaryUnit, target, isCurrency)}`,
  ];

  if (snap.basis === "monthly" && target === "week") {
    lines.push(
      "",
      `Calculation: ${snap.primaryValue.toFixed(0)} ÷ ${WEEKS_PER_MONTH.toFixed(4)} ≈ ${converted.toFixed(1)}`
    );
  }

  if (/class/i.test(question) && snap.extras?.monthlyClassSessions != null) {
    const sessions = convertValue(snap.extras.monthlyClassSessions, "monthly", target);
    lines.push("", `Scheduled class sessions: ${formatPeriodValue(sessions, "classes", target)}`);
  }
  if (/spot/i.test(question) && snap.extras?.occupiedSpots != null) {
    const spots = convertValue(snap.extras.occupiedSpots, "monthly", target);
    lines.push("", `Occupied spots: ${formatPeriodValue(spots, "spots", target)}`);
  }

  return {
    sections: [{ title: "CONVERSION", body: lines.join("\n") }],
    calculationSnapshot: snap,
  };
}

function shouldDeferMetricToTermExplain(question: string): boolean {
  const q = question.trim();
  return (
    /^what\s+is\s+(?:a\s+|an\s+|the\s+)?/i.test(q) &&
    !/\bmy\b/i.test(q) &&
    !/per\s+(week|day|month|year)/i.test(q) &&
    !/calculated/i.test(q) &&
    !/how much|how many/i.test(q) &&
    !/per\s+(spot|seat|class|client|session)/i.test(q) &&
    matchModelMetric(q) != null
  );
}

function answerMetricQuery(question: string, ctx: AskOwnedContext): OwnedAnswer | null {
  const metric = matchModelMetric(question);
  if (!metric) return null;

  const needsQuantity =
    isMetricQuantityQuestion(question) ||
    /what is|what's|how much|how many/i.test(question) ||
    /per (week|day|month|year)/i.test(question);
  if (!needsQuantity) return null;

  const value = metric.getValue(ctx.model, ctx.assumptions);
  const target = parseTargetPeriod(question);

  const lines = [formatMetricAnswer(metric, value, target)];
  if (metric.formula) {
    lines.push("", "FORMULA IN OWNED", "", metric.formula);
  }
  const body = lines.join("\n");

  const snapshot: CalculationSnapshot = {
    kind: "metric",
    label: metric.label,
    primaryValue: value.toNumber(),
    primaryUnit: metric.unit,
    basis: metric.basis === "absolute" ? "absolute" : metric.basis,
  };

  return {
    sections: [{ title: metric.label.toUpperCase(), body }],
    calculationSnapshot: metric.basis !== "absolute" ? snapshot : undefined,
  };
}

function answerDerivedRatio(question: string, ctx: AskOwnedContext): OwnedAnswer | null {
  if (!isDerivedRatioQuestion(question)) return null;

  const { model, assumptions } = ctx;
  const monthlyClasses = model.capacity.weeklyClasses.times(WEEKS_PER_MONTH).toNumber();

  if (/rent.*per class|cost per class/i.test(question)) {
    const perClass = assumptions.rent / Math.max(1, monthlyClasses);
    return {
      sections: [
        {
          title: "RENT PER CLASS",
          body: [
            `Rent: ${formatINR(assumptions.rent)} per month`,
            `Class sessions: ${monthlyClasses.toFixed(0)} per month`,
            `Rent per class session: ${formatINR(perClass)}`,
            "",
            `Calculation: ${formatINR(assumptions.rent)} ÷ ${monthlyClasses.toFixed(0)} classes`,
          ].join("\n"),
        },
      ],
    };
  }

  if (/profit.*per class|net profit.*per class/i.test(question)) {
    const perClass = model.pl.netProfit.toNumber() / Math.max(1, monthlyClasses);
    return {
      sections: [
        {
          title: "PROFIT PER CLASS",
          body: [
            `Planning net profit: ${formatINR(model.pl.netProfit)} per month`,
            `Class sessions: ${monthlyClasses.toFixed(0)} per month`,
            `Profit per class session: ${formatINR(perClass)}`,
          ].join("\n"),
        },
      ],
    };
  }

  if (/contribution.*per (?:full )?class|margin.*per (?:full )?class|^contribution per full class/i.test(question)) {
    const perSeat = model.unitEconomics.perSeat.contributionMarginPerSeat;
    const perClass = perSeat.times(assumptions.maxGroupClassSize);
    return {
      sections: [
        {
          title: "CONTRIBUTION PER FULL CLASS",
          body: [
            `Contribution per occupied spot: ${formatINR(perSeat)}`,
            `Max group class size: ${assumptions.maxGroupClassSize}`,
            `Contribution per full ${assumptions.maxGroupClassSize}/${assumptions.maxGroupClassSize} class: ${formatINR(perClass)}`,
          ].join("\n"),
        },
      ],
    };
  }

  if (/revenue.*per (class|session|spot)/i.test(question)) {
    const blended = model.revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot;
    const perFullClass = blended.times(assumptions.maxGroupClassSize);
    return {
      sections: [
        {
          title: "REVENUE PER CLASS",
          body: [
            `Blended net sales / occupied spot: ${formatINR(blended)}`,
            `Full ${assumptions.maxGroupClassSize}/${assumptions.maxGroupClassSize} class net sales: ${formatINR(perFullClass)}`,
          ].join("\n"),
        },
      ],
    };
  }

  return null;
}

function answerSpotsAtOccupancy(question: string, ctx: AskOwnedContext): OwnedAnswer | null {
  if (/class/i.test(question) && !/spot|seat/i.test(question)) return null;

  const occ = parseOccupancyFromQuestion(question) ?? ctx.occupancyHint;
  if (occ == null) return null;
  if (!/spot|seat|occup/i.test(question)) return null;
  if (!/how many|occupied|booked|at \d+/i.test(question)) return null;

  const result = computeClassCountAtOccupancy(
    ctx.assumptions,
    ctx.model,
    occ,
    ctx.classSizeHint ?? ctx.assumptions.maxGroupClassSize
  );

  const target = parseTargetPeriod(question);
  const body = [
    `At ${formatPercent(occ, 0)} booked occupancy:`,
    `Monthly available spots: ${result.monthlyAvailableSpots.toFixed(0)}`,
    `Occupied spots: ${result.occupiedSpots.toFixed(0)} per month`,
  ];

  if (target && target !== "month") {
    const converted = convertValue(result.occupiedSpots.toNumber(), "monthly", target);
    body.push(`Occupied spots: ${formatPeriodValue(converted, "spots", target)}`);
  }

  return {
    sections: [{ title: "OCCUPIED SPOTS", body: body.join("\n") }],
    calculationSnapshot: {
      kind: "capacity_spots",
      label: "Occupied reformer spots",
      primaryValue: result.occupiedSpots.toNumber(),
      primaryUnit: "spots",
      basis: "monthly",
      occupancyPct: occ,
      extras: { monthlyAvailableSpots: result.monthlyAvailableSpots.toNumber() },
    },
  };
}

function answerClassCountWithSnapshot(
  question: string,
  ctx: AskOwnedContext
): OwnedAnswer | null {
  if (isScheduleClassQuestion(question)) return null;

  if (!isClassCountQuestion(question) && !(/class/i.test(question) && /how many/i.test(question))) {
    return null;
  }

  const occupancyPct =
    parseOccupancyFromQuestion(question) ??
    ctx.occupancyHint ??
    ctx.assumptions.projectedBookedOccupancyPct;
  const classSize =
    parseFullClassSize(question, ctx.classSizeHint ?? ctx.assumptions.maxGroupClassSize);
  const result = computeClassCountAtOccupancy(ctx.assumptions, ctx.model, occupancyPct, classSize);
  const target = parseTargetPeriod(question);

  const lines = [
    `At ${formatPercent(occupancyPct, 0)} booked occupancy:`,
    "",
    `Monthly scheduled class sessions: ${result.monthlyClassSessions.toFixed(0)}`,
    `Monthly reformer spots available: ${result.monthlyAvailableSpots.toFixed(0)}`,
    `Occupied reformer spots: ${result.occupiedSpots.toFixed(0)}`,
    "",
    `Equivalent fully-booked ${classSize}/${classSize} classes: ${result.equivalentFullClasses.toFixed(0)} per month`,
  ];

  if (target === "week") {
    const weekly = convertValue(result.equivalentFullClasses.toNumber(), "monthly", "week");
    lines.push(`→ ${formatPeriodValue(weekly, "classes", "week")}`);
  } else if (target === "day") {
    const daily = convertValue(result.equivalentFullClasses.toNumber(), "monthly", "day");
    lines.push(`→ ${formatPeriodValue(daily, "classes", "day")}`);
  } else {
    const weekly = convertValue(result.equivalentFullClasses.toNumber(), "monthly", "week");
    lines.push(`→ ${formatPeriodValue(weekly, "classes", "week")} (for reference)`);
  }

  lines.push(
    "",
    "WHY IT IS THIS NUMBER",
    `${result.monthlyAvailableSpots.toFixed(0)} × ${formatPercent(occupancyPct, 0)} = ${result.occupiedSpots.toFixed(0)} occupied spots`,
    `${result.occupiedSpots.toFixed(0)} ÷ ${classSize} ≈ ${result.equivalentFullClasses.toFixed(0)} full classes per month`
  );

  return {
    sections: [{ title: "CLASS COUNT", body: lines.join("\n") }],
    calculationSnapshot: snapshotFromClassCount(result),
    guideLinks: [{ label: "Capacity", href: guideHref("capacity") }],
  };
}

function answerGenericMath(question: string, ctx: AskOwnedContext): OwnedAnswer | null {
  const { assumptions, model } = ctx;

  if (/how many reformers/i.test(question)) {
    return {
      sections: [{ title: "REFORMERS", body: `You have ${assumptions.reformers} reformers configured.` }],
    };
  }

  if (/classes per day|class sessions per day|how many classes per day/i.test(question)) {
    return {
      sections: [
        {
          title: "SCHEDULE",
          body: `${assumptions.classesPerDay} class sessions per day × ${assumptions.operatingDaysPerWeek} operating days = ${model.capacity.weeklyClasses.toFixed(0)} class sessions per week.`,
        },
      ],
    };
  }

  if (/annual.*profit|profit.*annual|profit.*year/i.test(question)) {
    const annual = model.pl.netProfit.times(12).toNumber();
    return {
      sections: [
        {
          title: "ANNUAL PROFIT",
          body: `Monthly planning net profit ${formatINR(model.pl.netProfit)} × 12 = ${formatINR(annual)} per year (steady-state, no escalation).`,
        },
      ],
      calculationSnapshot: {
        kind: "profit",
        label: "Planning net profit",
        primaryValue: model.pl.netProfit.toNumber(),
        primaryUnit: "INR",
        basis: "monthly",
      },
    };
  }

  if (/annual.*revenue|revenue.*year/i.test(question)) {
    const annual = model.revenue.netRevenue.times(12).toNumber();
    return {
      sections: [
        {
          title: "ANNUAL REVENUE",
          body: `Monthly net sales ${formatINR(model.revenue.netRevenue)} × 12 = ${formatINR(annual)} per year (steady-state).`,
        },
      ],
    };
  }

  return null;
}

/** Try deterministic math before glossary / guide fallback */
export function tryAnswerMathQuestion(question: string, ctx: AskOwnedContext): OwnedAnswer | null {
  const q = question.trim();
  if (!q) return null;

  const fundingBudget = answerFundingBudgetQuestion(q, ctx);
  if (fundingBudget) return fundingBudget;

  if (isCalculationQuestion(q)) {
    const calc = answerCalculationQuestion(q, ctx);
    if (calc) return calc;
  }

  if (shouldDeferMetricToTermExplain(q)) {
    return null;
  }

  const conversion = answerPeriodConversion(q, ctx);
  if (conversion) return conversion;

  // Schedule / metric queries before class-count (avoids "classes per week" mis-route)
  if (isScheduleClassQuestion(q)) {
    const metric = answerMetricQuery(q, ctx);
    if (metric) return metric;
    const generic = answerGenericMath(q, ctx);
    if (generic) return generic;
  }

  const derived = answerDerivedRatio(q, ctx);
  if (derived) return derived;

  const classCount = answerClassCountWithSnapshot(q, ctx);
  if (classCount) return classCount;

  const spots = answerSpotsAtOccupancy(q, ctx);
  if (spots) return spots;

  const metric = answerMetricQuery(q, ctx);
  if (metric) return metric;

  const generic = answerGenericMath(q, ctx);
  if (generic) return generic;

  if (isMetricQuantityQuestion(q)) {
    for (const m of MODEL_METRICS) {
      const words = m.label.toLowerCase().split(/\s+/);
      if (words.some((w) => w.length > 3 && q.toLowerCase().includes(w))) {
        return answerMetricQuery(`${m.label} ${q}`, ctx);
      }
    }
  }

  return null;
}

export function extractSnapshotFromAnswer(answer: OwnedAnswer): CalculationSnapshot | undefined {
  return answer.calculationSnapshot;
}
