import type { FinanceAssumptions } from "../schemas";

/** Attendance yield from booked: (1 − cancel) × (1 − noShow). */
export function bookedToAttendedYield(assumptions: FinanceAssumptions): number {
  const cancel = assumptions.cancellationRatePct / 100;
  const noShow = assumptions.noShowRatePct / 100;
  return (1 - cancel) * (1 - noShow);
}

/**
 * Resolve attended occupancy (% of capacity, 0–100) from booked occupancy.
 * Linked mode: attended = booked × cancel/no-show yield, capped at booked.
 * Manual mode: uses stored projectedAttendedOccupancyPct, capped at booked.
 */
export function resolveAttendedOccupancyPct(
  assumptions: FinanceAssumptions,
  bookedOccupancyPct: number
): number {
  const booked = Math.min(100, Math.max(0, bookedOccupancyPct));

  if ((assumptions.attendedOccupancyMode ?? "linked") === "manual") {
    return Math.min(booked, Math.max(0, assumptions.projectedAttendedOccupancyPct));
  }

  const attended = booked * bookedToAttendedYield(assumptions);
  return Math.min(booked, Math.max(0, attended));
}

/** Steady-state attended % from target booked — for syncing assumptions on save. */
export function resolveSteadyStateAttendedPct(assumptions: FinanceAssumptions): number {
  return resolveAttendedOccupancyPct(
    assumptions,
    assumptions.projectedBookedOccupancyPct
  );
}
