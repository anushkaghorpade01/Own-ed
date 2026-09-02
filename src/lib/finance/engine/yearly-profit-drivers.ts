import { d, sum } from "../decimal";
import type { MonthlyPLSnapshot } from "./monthly-projection";
import type { YearlyPLRow } from "./yearly-pl";
import { collectStructuralChangesInRange, detectStructuralChangesBetween } from "./forecast-timeline";
import Decimal from "decimal.js";

export interface ProfitImpactDriver {
  label: string;
  /** Positive = helps net profit; negative = reduces net profit */
  impact: Decimal;
}

export interface YearProfitExplanation {
  year: number;
  direction: "baseline" | "up" | "down" | "flat";
  netProfitChange: Decimal | null;
  summary: string;
  detail: string;
  topDrivers: ProfitImpactDriver[];
  structuralNotes: string[];
}

const MATERIAL_THRESHOLD = 5_000;

function avgOccupancy(
  monthly: MonthlyPLSnapshot[],
  startMonth: number,
  endMonth: number
): Decimal {
  const slice = monthly.filter((m) => m.month >= startMonth && m.month <= endMonth);
  if (slice.length === 0) return d(0);
  return sum(slice.map((m) => m.occupancyPct)).dividedBy(slice.length);
}

function formatCompactInr(value: Decimal): string {
  const abs = value.abs();
  if (abs.gte(100_000)) {
    return `₹${abs.dividedBy(100_000).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()}L`;
  }
  if (abs.gte(1_000)) {
    return `₹${abs.dividedBy(1_000).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toString()}K`;
  }
  return `₹${abs.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString()}`;
}

function signedCompactInr(value: Decimal): string {
  if (value.isZero()) return "₹0";
  const sign = value.isNegative() ? "−" : "+";
  return `${sign}${formatCompactInr(value)}`;
}

function buildBaselineExplanation(
  monthly: MonthlyPLSnapshot[],
  curr: YearlyPLRow
): YearProfitExplanation {
  const startOcc = monthly.find((m) => m.month === curr.startMonth)?.occupancyPct ?? d(0);
  const endOcc = monthly.find((m) => m.month === curr.endMonth)?.occupancyPct ?? d(0);
  const avgOcc = avgOccupancy(monthly, curr.startMonth, curr.endMonth);

  const structuralChanges = collectStructuralChangesInRange(
    monthly.map((m) => ({ month: m.month, structural: m.structural })),
    curr.startMonth,
    curr.endMonth
  );
  const structuralNotes = structuralChanges.map((n) => n.message);

  const summary =
    `Opening operating year. Net profit reflects the occupancy ramp ` +
    `(${startOcc.toDecimalPlaces(0).toString()}% → ${endOcc.toDecimalPlaces(0).toString()}% across months ${curr.startMonth}–${curr.endMonth}), ` +
    `averaging ${avgOcc.toDecimalPlaces(0).toString()}% with base pricing and costs.`;

  const detail = [
    summary,
    `Net profit: ${formatCompactInr(curr.netProfit)} (${curr.netProfitMarginPct.toDecimalPlaces(1).toString()}% margin).`,
    structuralNotes.length > 0
      ? `Structural changes in Year 1: ${structuralNotes.join(" ")}`
      : "No mid-year structural changes in Year 1 — configure capacity or service additions under Assumptions → Forecast structural changes.",
    "Change assumptions — occupancy ramp, pricing, capacity, or cost escalation — and this updates automatically.",
  ].join("\n\n");

  return {
    year: curr.year,
    direction: "baseline",
    netProfitChange: null,
    summary,
    detail,
    topDrivers: [],
    structuralNotes,
  };
}

function revenueSubDrivers(prev: YearlyPLRow, curr: YearlyPLRow): ProfitImpactDriver[] {
  return [
    { label: "Credit packs", impact: curr.groupClassRevenue.minus(prev.groupClassRevenue) },
    { label: "Drop-In", impact: curr.dropInRevenue.minus(prev.dropInRevenue) },
    { label: "Private sessions", impact: curr.privateRevenue.minus(prev.privateRevenue) },
    { label: "Standing Spot", impact: curr.standingSpotRevenue.minus(prev.standingSpotRevenue) },
    { label: "Standby", impact: curr.standbyRevenue.minus(prev.standbyRevenue) },
  ].filter((driver) => driver.impact.abs().gte(MATERIAL_THRESHOLD));
}

function buildChangeExplanation(
  monthly: MonthlyPLSnapshot[],
  prev: YearlyPLRow,
  curr: YearlyPLRow
): YearProfitExplanation {
  const profitDelta = curr.netProfit.minus(prev.netProfit);
  const direction = profitDelta.gt(MATERIAL_THRESHOLD)
    ? "up"
    : profitDelta.lt(-MATERIAL_THRESHOLD)
      ? "down"
      : "flat";

  const impacts: ProfitImpactDriver[] = [
    { label: "Net sales", impact: curr.netRevenue.minus(prev.netRevenue) },
    { label: "Direct costs", impact: prev.directCosts.minus(curr.directCosts) },
    { label: "Instructor delivery", impact: prev.instructorDelivery.minus(curr.instructorDelivery) },
    { label: "Consumables", impact: prev.sessionConsumables.minus(curr.sessionConsumables) },
    { label: "Payment processing", impact: prev.paymentFees.minus(curr.paymentFees) },
    { label: "Payroll", impact: prev.payroll.minus(curr.payroll) },
    { label: "Rent", impact: prev.rent.minus(curr.rent) },
    { label: "Utilities", impact: prev.utilities.minus(curr.utilities) },
    { label: "Software", impact: prev.software.minus(curr.software) },
    { label: "Marketing", impact: prev.marketing.minus(curr.marketing) },
    { label: "Repairs & maintenance", impact: prev.repairs.minus(curr.repairs) },
    { label: "Other operating", impact: prev.otherOpex.minus(curr.otherOpex) },
    {
      label: "Depreciation & financing",
      impact: prev.depreciation
        .plus(prev.interestExpense)
        .minus(curr.depreciation)
        .minus(curr.interestExpense),
    },
  ];

  const significant = impacts
    .filter((driver) => driver.impact.abs().gte(MATERIAL_THRESHOLD))
    .sort((a, b) => b.impact.abs().minus(a.impact.abs()).toNumber());

  const helps = significant.filter((driver) => driver.impact.gt(0));
  const hurts = significant.filter((driver) => driver.impact.lt(0));

  const occPrev = avgOccupancy(monthly, prev.startMonth, prev.endMonth);
  const occCurr = avgOccupancy(monthly, curr.startMonth, curr.endMonth);
  const occDelta = occCurr.minus(occPrev);

  const revenueChange = curr.netRevenue.minus(prev.netRevenue);
  const revenueSub = revenueSubDrivers(prev, curr).sort((a, b) =>
    b.impact.abs().minus(a.impact.abs()).toNumber()
  );

  const structuralChanges = collectStructuralChangesInRange(
    monthly.map((m) => ({ month: m.month, structural: m.structural })),
    curr.startMonth,
    curr.endMonth
  );
  const prevEnd = monthly.find((m) => m.month === prev.endMonth);
  const currStart = monthly.find((m) => m.month === curr.startMonth);
  const boundaryNotes =
    prevEnd && currStart
      ? detectStructuralChangesBetween(prevEnd.structural, currStart.structural, curr.startMonth)
      : [];
  const allStructural = [...boundaryNotes, ...structuralChanges];
  const structuralNotes = allStructural.map((n) => n.message);

  const parts: string[] = [];

  if (direction === "flat") {
    parts.push(
      `Net profit is broadly unchanged vs Year ${prev.year} (${signedCompactInr(profitDelta)}).`
    );
  } else if (direction === "up") {
    parts.push(
      `Net profit is ${formatCompactInr(profitDelta)} higher than Year ${prev.year}.`
    );
  } else {
    parts.push(
      `Net profit is ${formatCompactInr(profitDelta.abs())} lower than Year ${prev.year}.`
    );
  }

  if (revenueChange.abs().gte(MATERIAL_THRESHOLD)) {
    const revDir = revenueChange.gt(0) ? "rose" : "fell";
    parts.push(`Net sales ${revDir} by ${formatCompactInr(revenueChange.abs())}.`);

    if (occDelta.abs().gte(1)) {
      parts.push(
        `Average occupancy moved from ${occPrev.toDecimalPlaces(0).toString()}% to ${occCurr.toDecimalPlaces(0).toString()}%.`
      );
    } else if (revenueChange.gt(0)) {
      parts.push("Sales growth is mainly from pricing or product mix, not occupancy.");
    }

    if (revenueSub.length > 0) {
      const topRev = revenueSub[0];
      parts.push(
        `Largest sales shift: ${topRev.label} (${signedCompactInr(topRev.impact)}).`
      );
    }
  } else if (direction === "down") {
    parts.push("Net sales were flat while costs continued to rise.");
  }

  if (helps.length > 0) {
    parts.push(
      `Helped profit: ${helps
        .slice(0, 2)
        .map((driver) => `${driver.label} (${signedCompactInr(driver.impact)})`)
        .join(", ")}.`
    );
  }

  if (hurts.length > 0) {
    parts.push(
      `Reduced profit: ${hurts
        .slice(0, 3)
        .map((driver) => `${driver.label} (${signedCompactInr(driver.impact)})`)
        .join(", ")}.`
    );
  }

  if (direction === "down" && revenueChange.lte(MATERIAL_THRESHOLD) && hurts.length > 0) {
    parts.push("Cost escalation is outpacing sales under this scenario.");
  }

  if (direction === "up" && revenueChange.gt(0) && hurts.length > 0) {
    parts.push("Sales growth more than offset rising costs.");
  }

  if (structuralNotes.length > 0) {
    parts.push(`Structural changes this year: ${structuralNotes[0]}`);
    if (structuralNotes.length > 1) {
      parts.push(`Also: ${structuralNotes.slice(1, 3).join(" ")}`);
    }
  }

  const avgSeatsPrev = avgMonthlySeats(monthly, prev.startMonth, prev.endMonth);
  const avgSeatsCurr = avgMonthlySeats(monthly, curr.startMonth, curr.endMonth);
  if (
    structuralNotes.length === 0 &&
    avgSeatsCurr.gt(avgSeatsPrev.plus(10)) &&
    revenueChange.gt(MATERIAL_THRESHOLD)
  ) {
    parts.push(
      `Higher available capacity (${Math.round(avgSeatsPrev.toNumber())} → ${Math.round(avgSeatsCurr.toNumber())} seats/month avg) supported revenue growth.`
    );
  }

  const summary = parts.join(" ");

  const detailLines = [
    summary,
    "",
    "Driver breakdown (impact on net profit):",
    ...significant.slice(0, 6).map(
      (driver) => `• ${driver.label}: ${signedCompactInr(driver.impact)}`
    ),
  ];

  if (occDelta.abs().gte(0.5)) {
    detailLines.push(
      "",
      `Occupancy: ${occPrev.toDecimalPlaces(1).toString()}% → ${occCurr.toDecimalPlaces(1).toString()}% (year average).`
    );
  }

  if (structuralNotes.length > 0) {
    detailLines.push("", "Structural assumption changes this year:");
    structuralNotes.forEach((note) => detailLines.push(`• ${note}`));
  } else {
    detailLines.push(
      "",
      "No structural changes (reformers, schedule, new services) configured for this year — profit movement is from occupancy, pricing, and cost escalation."
    );
  }

  return {
    year: curr.year,
    direction,
    netProfitChange: profitDelta,
    summary,
    detail: detailLines.join("\n"),
    topDrivers: significant.slice(0, 5),
    structuralNotes,
  };
}

function avgMonthlySeats(
  monthly: MonthlyPLSnapshot[],
  startMonth: number,
  endMonth: number
): Decimal {
  const slice = monthly.filter((m) => m.month >= startMonth && m.month <= endMonth);
  if (slice.length === 0) return d(0);
  return sum(slice.map((m) => d(m.structural.monthlyAvailableSeats))).dividedBy(slice.length);
}

export function analyzeYearlyProfitDrivers(
  monthly: MonthlyPLSnapshot[],
  years: YearlyPLRow[]
): YearProfitExplanation[] {
  return years.map((curr, index) => {
    if (index === 0) return buildBaselineExplanation(monthly, curr);
    return buildChangeExplanation(monthly, years[index - 1], curr);
  });
}
