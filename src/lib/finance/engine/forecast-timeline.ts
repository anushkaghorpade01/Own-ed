import type { FinanceAssumptions, ScenarioTimelinePhase } from "../schemas";
import { applyMonthAssumptions, resolveForecastSettings } from "./escalation";
import { mergeAssumptionsForMonth } from "./scenarios";

export function phaseLabelAt(
  timeline: ScenarioTimelinePhase[],
  month: number
): string | undefined {
  return timeline.find((p) => month >= p.startMonth && month <= p.endMonth)?.label;
}

/** Apply forecast timeline structural overrides, then cost/price escalation for the month. */
export function resolveMonthAssumptions(
  base: FinanceAssumptions,
  month: number
): FinanceAssumptions {
  const forecast = resolveForecastSettings(base);
  const withTimeline = mergeAssumptionsForMonth(
    base,
    forecast.forecastTimeline ?? [],
    month
  );
  return applyMonthAssumptions(withTimeline, month);
}

export interface MonthStructuralSnapshot {
  reformers: number;
  classesPerDay: number;
  operatingDaysPerWeek: number;
  monthlyAvailableSeats: number;
  standingSpotEnabled: boolean;
  standbyEnabled: boolean;
  privateSessionsPerMonth: number;
  privateMixPct: number;
  phaseLabel?: string;
}

export function captureStructuralSnapshot(
  assumptions: FinanceAssumptions,
  monthlyAvailableSeats: number,
  timeline: ScenarioTimelinePhase[],
  month: number
): MonthStructuralSnapshot {
  const privateProduct = assumptions.products.find((p) => p.type === "private");
  const privateMix =
    privateProduct?.serviceDemandPct ??
    assumptions.accessProductMix?.privateDuoPct ??
    0;

  return {
    reformers: assumptions.reformers,
    classesPerDay: assumptions.classesPerDay,
    operatingDaysPerWeek: assumptions.operatingDaysPerWeek,
    monthlyAvailableSeats,
    standingSpotEnabled: assumptions.standingSpotEnabled,
    standbyEnabled: assumptions.standbyEnabled,
    privateSessionsPerMonth: assumptions.privateSessionsPerMonth,
    privateMixPct: privateMix,
    phaseLabel: phaseLabelAt(timeline, month),
  };
}

export interface StructuralChangeNote {
  month: number;
  message: string;
}

/** Detect structural assumption changes between consecutive months. */
export function detectStructuralChangesBetween(
  before: MonthStructuralSnapshot,
  after: MonthStructuralSnapshot,
  month: number
): StructuralChangeNote[] {
  const notes: StructuralChangeNote[] = [];

  if (after.reformers !== before.reformers) {
    notes.push({
      month,
      message: `Reformer capacity changed: ${before.reformers} → ${after.reformers} reformers (month ${month}).`,
    });
  }

  if (after.classesPerDay !== before.classesPerDay) {
    notes.push({
      month,
      message: `Schedule expanded: ${before.classesPerDay} → ${after.classesPerDay} classes/day from month ${month}.`,
    });
  }

  if (after.operatingDaysPerWeek !== before.operatingDaysPerWeek) {
    notes.push({
      month,
      message: `Operating week changed: ${before.operatingDaysPerWeek} → ${after.operatingDaysPerWeek} days/week from month ${month}.`,
    });
  }

  if (after.standingSpotEnabled && !before.standingSpotEnabled) {
    notes.push({
      month,
      message: `Standing Spot service activated from month ${month}.`,
    });
  }

  if (after.standbyEnabled && !before.standbyEnabled) {
    notes.push({
      month,
      message: `Standby access activated from month ${month}.`,
    });
  }

  if (Math.abs(after.privateMixPct - before.privateMixPct) >= 1) {
    notes.push({
      month,
      message: `Private service mix shifted: ${before.privateMixPct}% → ${after.privateMixPct}% of occupied bookings from month ${month}.`,
    });
  }

  if (after.privateSessionsPerMonth !== before.privateSessionsPerMonth) {
    notes.push({
      month,
      message: `Private session volume changed: ${before.privateSessionsPerMonth} → ${after.privateSessionsPerMonth}/month from month ${month}.`,
    });
  }

  const seatsDelta = after.monthlyAvailableSeats - before.monthlyAvailableSeats;
  if (
    seatsDelta !== 0 &&
    after.reformers === before.reformers &&
    after.classesPerDay === before.classesPerDay &&
    after.operatingDaysPerWeek === before.operatingDaysPerWeek
  ) {
    notes.push({
      month,
      message: `Available capacity changed by ${seatsDelta > 0 ? "+" : ""}${Math.round(seatsDelta)} seats/month from month ${month}.`,
    });
  }

  return notes;
}

export function collectStructuralChangesInRange(
  snapshots: Array<{ month: number; structural: MonthStructuralSnapshot }>,
  startMonth: number,
  endMonth: number
): StructuralChangeNote[] {
  const inRange = snapshots.filter(
    (s) => s.month >= startMonth && s.month <= endMonth
  );
  const notes: StructuralChangeNote[] = [];

  for (let i = 1; i < inRange.length; i++) {
    const prev = inRange[i - 1];
    const curr = inRange[i];
    if (
      prev.structural.reformers === curr.structural.reformers &&
      prev.structural.classesPerDay === curr.structural.classesPerDay &&
      prev.structural.operatingDaysPerWeek === curr.structural.operatingDaysPerWeek &&
      prev.structural.standingSpotEnabled === curr.structural.standingSpotEnabled &&
      prev.structural.standbyEnabled === curr.structural.standbyEnabled &&
      prev.structural.privateMixPct === curr.structural.privateMixPct &&
      prev.structural.privateSessionsPerMonth === curr.structural.privateSessionsPerMonth &&
      prev.structural.monthlyAvailableSeats === curr.structural.monthlyAvailableSeats
    ) {
      continue;
    }
    notes.push(
      ...detectStructuralChangesBetween(prev.structural, curr.structural, curr.month)
    );
  }

  return notes;
}
