import { d, WEEKS_PER_MONTH, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, ClassScheduleEntry } from "../schemas";
import Decimal from "decimal.js";
import { resolveAttendedOccupancyPct } from "./attended-occupancy";

export interface CapacityResult {
  weeklyAvailableSeats: Decimal;
  monthlyAvailableSeats: Decimal;
  annualAvailableSeats: Decimal;
  weeklyClasses: Decimal;
  usableOperatingWeeksPerYear: Decimal;
  occupiedSeatsMonthly: Decimal;
  attendedSeatsMonthly: Decimal;
  traces: {
    weeklySeats: CalculationTrace;
    monthlySeats: CalculationTrace;
    occupiedSeats: CalculationTrace;
  };
  slotCapacity: SlotCapacityEntry[];
}

export interface SlotCapacityEntry {
  day: string;
  startTime: string;
  capacity: number;
  available: Decimal;
  booked: Decimal;
  attended: Decimal;
  bookedOccupancyPct: Decimal;
  attendedOccupancyPct: Decimal;
  waitlistCount: number;
  failedAttempts: number;
}

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function calculateCapacity(
  assumptions: FinanceAssumptions,
  occupancyOverride?: Decimal
): CapacityResult {
  const usableWeeks = d(52).minus(assumptions.weeksClosedPerYear);

  let weeklyAvailableSeats: Decimal;
  let weeklyClasses: Decimal;
  let weeklyTrace: CalculationTrace;

  if (assumptions.useScheduleForCapacity && assumptions.schedule.length > 0) {
    weeklyAvailableSeats = assumptions.schedule.reduce(
      (acc, entry) => acc.plus(entry.capacity),
      new Decimal(0)
    );
    weeklyClasses = d(assumptions.schedule.length);
    weeklyTrace = trace(
      "Weekly available seats (from schedule)",
      "Sum of scheduled class capacities per week",
      "seats/week",
      [
        {
          label: "Scheduled classes",
          expression: `${assumptions.schedule.length} classes`,
          result: weeklyClasses,
        },
        {
          label: "Total seat capacity",
          expression: assumptions.schedule
            .map((s) => `${s.capacity}`)
            .join(" + "),
          result: weeklyAvailableSeats,
        },
      ],
      weeklyAvailableSeats
    );
  } else {
    weeklyAvailableSeats = d(assumptions.reformers)
      .times(assumptions.classesPerDay)
      .times(assumptions.operatingDaysPerWeek);
    weeklyClasses = d(assumptions.classesPerDay).times(
      assumptions.operatingDaysPerWeek
    );
    weeklyTrace = trace(
      "Weekly available seats",
      "reformers × classes/day × operating days/week",
      "seats/week",
      [
        {
          label: "Reformers",
          expression: `${assumptions.reformers}`,
          result: d(assumptions.reformers),
        },
        {
          label: "Classes per day",
          expression: `${assumptions.classesPerDay}`,
          result: d(assumptions.classesPerDay),
        },
        {
          label: "Operating days per week",
          expression: `${assumptions.operatingDaysPerWeek}`,
          result: d(assumptions.operatingDaysPerWeek),
        },
        {
          label: "Weekly seats",
          expression: `${assumptions.reformers} × ${assumptions.classesPerDay} × ${assumptions.operatingDaysPerWeek}`,
          result: weeklyAvailableSeats,
        },
      ],
      weeklyAvailableSeats
    );
  }

  const monthlyAvailableSeats = weeklyAvailableSeats.times(WEEKS_PER_MONTH);
  const monthlyTrace = trace(
    "Monthly available seats",
    "weekly seats × 52 / 12",
    "seats/month",
    [
      {
        label: "Weekly seats",
        expression: weeklyAvailableSeats.toString(),
        result: weeklyAvailableSeats,
      },
      {
        label: "Weeks per month",
        expression: "52 / 12 = 4.333...",
        result: WEEKS_PER_MONTH,
      },
      {
        label: "Monthly seats",
        expression: `${weeklyAvailableSeats.toString()} × 52 / 12`,
        result: monthlyAvailableSeats,
      },
    ],
    monthlyAvailableSeats
  );

  const annualAvailableSeats = weeklyAvailableSeats.times(usableWeeks);

  const occupancyPct =
    occupancyOverride ?? d(assumptions.projectedBookedOccupancyPct).dividedBy(100);
  const bookedOccupancyPct = occupancyPct.times(100).toNumber();
  const attendedOccupancyPct = resolveAttendedOccupancyPct(
    assumptions,
    bookedOccupancyPct
  );
  const attendedPct = d(attendedOccupancyPct).dividedBy(100);

  const occupiedSeatsMonthly = monthlyAvailableSeats.times(occupancyPct);
  const attendedSeatsMonthly = monthlyAvailableSeats.times(attendedPct);

  const occupiedTrace = trace(
    "Monthly occupied seats",
    "monthly available seats × booked occupancy %",
    "seats/month",
    [
      {
        label: "Monthly available seats",
        expression: monthlyAvailableSeats.toString(),
        result: monthlyAvailableSeats,
      },
      {
        label: "Booked occupancy",
        expression: `${assumptions.projectedBookedOccupancyPct}%`,
        result: occupancyPct,
      },
      {
        label: "Occupied seats",
        expression: `${monthlyAvailableSeats.toString()} × ${occupancyPct.toString()}`,
        result: occupiedSeatsMonthly,
      },
    ],
    occupiedSeatsMonthly
  );

  const slotCapacity = buildSlotCapacity(assumptions);

  return {
    weeklyAvailableSeats,
    monthlyAvailableSeats,
    annualAvailableSeats,
    weeklyClasses,
    usableOperatingWeeksPerYear: usableWeeks,
    occupiedSeatsMonthly,
    attendedSeatsMonthly,
    traces: {
      weeklySeats: weeklyTrace,
      monthlySeats: monthlyTrace,
      occupiedSeats: occupiedTrace,
    },
    slotCapacity,
  };
}

function buildSlotCapacity(assumptions: FinanceAssumptions): SlotCapacityEntry[] {
  if (assumptions.schedule.length === 0) return [];

  return assumptions.schedule
    .slice()
    .sort(
      (a, b) =>
        DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
        a.startTime.localeCompare(b.startTime)
    )
    .map((entry) => slotFromEntry(entry, assumptions));
}

function slotFromEntry(
  entry: ClassScheduleEntry,
  assumptions: FinanceAssumptions
): SlotCapacityEntry {
  const bookedOccupancyPct =
    entry.bookedOccupancyPct ?? assumptions.projectedBookedOccupancyPct;
  const bookedPct = d(bookedOccupancyPct).dividedBy(100);
  const attendedOccupancyPct =
    entry.attendedOccupancyPct ??
    resolveAttendedOccupancyPct(assumptions, bookedOccupancyPct);
  const attendedPct = d(attendedOccupancyPct).dividedBy(100);
  const monthlySlots = WEEKS_PER_MONTH;
  const available = d(entry.capacity).times(monthlySlots);
  const booked = available.times(bookedPct);
  const attended = available.times(attendedPct);

  return {
    day: entry.day,
    startTime: entry.startTime,
    capacity: entry.capacity,
    available,
    booked,
    attended,
    bookedOccupancyPct: bookedPct.times(100),
    attendedOccupancyPct: attendedPct.times(100),
    waitlistCount: entry.waitlistCount ?? 0,
    failedAttempts: entry.failedBookingAttempts ?? 0,
  };
}

export function calculateRealisationRate(
  bookedSeats: Decimal,
  attendedSeats: Decimal
): Decimal {
  if (bookedSeats.isZero()) return new Decimal(0);
  return attendedSeats.dividedBy(bookedSeats);
}

export interface SchedulingRecommendation {
  slot: string;
  occupancyPct: Decimal;
  avgUtilisation: string;
  waitlistAttempts: number;
  failedBookings: number;
  status: "no_expansion" | "healthy" | "monitor" | "constrained" | "expansion";
  suggestion: string;
  redistribution?: string;
}

export function generateSchedulingRecommendations(
  assumptions: FinanceAssumptions,
  rollingWeeks = 4
): SchedulingRecommendation[] {
  const capacity = calculateCapacity(assumptions);
  const recommendations: SchedulingRecommendation[] = [];

  for (const slot of capacity.slotCapacity) {
    const occ = slot.bookedOccupancyPct;
    const filled = slot.booked.dividedBy(slot.available.dividedBy(WEEKS_PER_MONTH));
    const avgFilled = filled.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    const utilisation = `${Math.min(avgFilled, slot.capacity)} / ${slot.capacity}`;

    let status: SchedulingRecommendation["status"] = "healthy";
    let suggestion = "No action needed.";

    if (occ.lt(60)) {
      status = "no_expansion";
      suggestion = "Below 60% occupancy — no expansion suggested.";
    } else if (occ.lt(75)) {
      status = "healthy";
      suggestion = "Healthy occupancy range.";
    } else if (occ.lt(85)) {
      status = "monitor";
      suggestion = "Monitor — approaching capacity constraints.";
    } else if (occ.lt(90)) {
      status = "constrained";
      suggestion = "Capacity becoming constrained — evaluate adjacent slots.";
    } else {
      status = "expansion";
      suggestion = `Sustained ${occ.toFixed(0)}%+ utilisation with ${slot.waitlistCount} waitlist attempts — consider testing an additional class nearby.`;
    }

    if (
      slot.capacity <= 3 &&
      slot.waitlistCount >= 8 &&
      occ.gte(90)
    ) {
      suggestion = `${slot.day} ${slot.startTime}: ${utilisation} average utilisation, ${slot.waitlistCount} waitlist attempts in last ${rollingWeeks} weeks, ${slot.failedAttempts} failed bookings. Suggested: Test additional class slot.`;
    }

    recommendations.push({
      slot: `${slot.day} ${slot.startTime}`,
      occupancyPct: occ,
      avgUtilisation: utilisation,
      waitlistAttempts: slot.waitlistCount,
      failedBookings: slot.failedAttempts,
      status,
      suggestion,
    });
  }

  return recommendations;
}
