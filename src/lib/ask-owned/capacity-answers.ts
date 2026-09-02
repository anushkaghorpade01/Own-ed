import Decimal from "decimal.js";
import { d, WEEKS_PER_MONTH } from "@/lib/finance/decimal";
import { calculateCapacity } from "@/lib/finance/engine/capacity";
import type { FinanceAssumptions } from "@/lib/finance/schemas";
import type { FinanceModelOutput } from "@/lib/finance/run-model";
import { formatPercent } from "@/lib/format/currency";
import type { OwnedAnswer } from "./types";
import { guideHref } from "./guide-search";

export function isClassCountQuestion(question: string): boolean {
  return (
    /how many classes/i.test(question) ||
    /class count/i.test(question) ||
    /completely booked/i.test(question) ||
    /fully booked/i.test(question) ||
    /\d+\s*\/\s*\d+/.test(question) ||
    /at\s+\d+\s*%\s*occupancy.*class/i.test(question) ||
    /occupancy.*how many class/i.test(question)
  );
}

/** Parse occupancy % from phrases like "at 75% occupancy" or "occupancy is 80%" */
export function parseOccupancyFromQuestion(question: string): number | null {
  const patterns = [
    /at\s+(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*%\s*occupancy/i,
    /occupancy\s*(?:of|at|is|=)\s*(\d+(?:\.\d+)?)\s*%/i,
  ];
  for (const p of patterns) {
    const m = question.match(p);
    if (m?.[1]) {
      const n = parseFloat(m[1]);
      if (n >= 0 && n <= 100) return n;
    }
  }
  return null;
}

/** Parse full-class size from "3/3" or explicit group size */
export function parseFullClassSize(question: string, defaultSize: number): number {
  const frac = question.match(/(\d+)\s*\/\s*(\d+)/);
  if (frac?.[2]) {
    const n = parseInt(frac[2], 10);
    if (n > 0) return n;
  }
  const explicit = question.match(/(?:class(?:es)?\s+(?:of|with|size)\s+)?(\d+)\s*(?:people|spots|reformers)/i);
  if (explicit?.[1]) {
    const n = parseInt(explicit[1], 10);
    if (n > 0) return n;
  }
  return defaultSize;
}

export interface ClassCountResult {
  occupancyPct: number;
  classSize: number;
  monthlyClassSessions: Decimal;
  monthlyAvailableSpots: Decimal;
  occupiedSpots: Decimal;
  equivalentFullClasses: Decimal;
  breakEvenFullClasses: Decimal | null;
  breakEvenOccupiedSpots: Decimal | null;
}

export function computeClassCountAtOccupancy(
  assumptions: FinanceAssumptions,
  model: FinanceModelOutput,
  occupancyPct: number,
  classSize: number
): ClassCountResult {
  const cap = calculateCapacity(assumptions, d(occupancyPct).dividedBy(100));
  const monthlyClassSessions = cap.weeklyClasses.times(WEEKS_PER_MONTH);
  const occupiedSpots = cap.occupiedSeatsMonthly;
  const equivalentFullClasses = classSize > 0 ? occupiedSpots.dividedBy(classSize) : d(0);

  const be = model.breakEven.contributionBreakEven;
  const breakEvenFullClasses = classSize > 0 ? be.requiredOccupiedSeats.dividedBy(classSize) : null;

  return {
    occupancyPct,
    classSize,
    monthlyClassSessions,
    monthlyAvailableSpots: cap.monthlyAvailableSeats,
    occupiedSpots,
    equivalentFullClasses,
    breakEvenFullClasses,
    breakEvenOccupiedSpots: be.requiredOccupiedSeats,
  };
}

export function answerClassCountQuestion(
  question: string,
  assumptions: FinanceAssumptions,
  model: FinanceModelOutput,
  occupancyHint?: number
): OwnedAnswer {
  const occupancyPct =
    parseOccupancyFromQuestion(question) ??
    occupancyHint ??
    assumptions.projectedBookedOccupancyPct;
  const classSize = parseFullClassSize(question, assumptions.maxGroupClassSize);
  const result = computeClassCountAtOccupancy(assumptions, model, occupancyPct, classSize);

  const wantsBreakEven = /break[- ]?even|cover\s+(?:fixed|costs|rent|bills)/i.test(question);

  const lines = [
    `At ${formatPercent(occupancyPct, 0)} booked occupancy:`,
    "",
    `Monthly scheduled class sessions: ${result.monthlyClassSessions.toFixed(0)}`,
    `Monthly reformer spots available: ${result.monthlyAvailableSpots.toFixed(0)}`,
    `Occupied reformer spots: ${result.occupiedSpots.toFixed(0)}`,
    "",
    `Equivalent fully-booked ${result.classSize}/${result.classSize} classes: ${result.equivalentFullClasses.toFixed(0)} per month`,
    "",
    "WHY IT IS THIS NUMBER",
    `${result.monthlyAvailableSpots.toFixed(0)} spots × ${formatPercent(occupancyPct, 0)} = ${result.occupiedSpots.toFixed(0)} occupied spots`,
    `${result.occupiedSpots.toFixed(0)} ÷ ${result.classSize} spots per full class ≈ ${result.equivalentFullClasses.toFixed(0)} full classes`,
  ];

  if (wantsBreakEven && result.breakEvenFullClasses && result.breakEvenOccupiedSpots) {
    lines.push(
      "",
      "BREAK-EVEN (fixed costs)",
      `Spots needed to cover fixed operating costs: ${result.breakEvenOccupiedSpots.toFixed(0)}`,
      `Equivalent full ${result.classSize}/${result.classSize} classes for break-even: ${result.breakEvenFullClasses.toFixed(0)} per month`,
      `Break-even occupancy: ${formatPercent(model.breakEven.contributionBreakEven.breakEvenOccupancyPct)}`
    );
  } else if (!wantsBreakEven) {
    lines.push(
      "",
      "Note: You do not need every scheduled class to be full. This is the total occupied spots expressed as equivalent full classes.",
      `Your studio schedules ${result.monthlyClassSessions.toFixed(0)} class sessions per month (${assumptions.classesPerDay} per day × ${assumptions.operatingDaysPerWeek} days × 52/12 weeks).`
    );
  }

  if (occupancyPct !== assumptions.projectedBookedOccupancyPct) {
    lines.push(
      "",
      `Compared to your current planned occupancy (${formatPercent(assumptions.projectedBookedOccupancyPct, 0)}): ${model.capacity.occupiedSeatsMonthly.toFixed(0)} occupied spots (${model.capacity.occupiedSeatsMonthly.dividedBy(classSize).toFixed(0)} equivalent full classes).`
    );
  }

  return {
    sections: [{ title: "CLASS COUNT", body: lines.join("\n") }],
    guideLinks: [{ label: "Capacity", href: guideHref("capacity") }],
  };
}
