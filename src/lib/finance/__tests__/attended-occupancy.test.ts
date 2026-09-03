import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { calculateCapacity } from "../engine/capacity";
import { getRampUpOccupancy } from "../engine/cash-flow";
import { resolveAttendedOccupancyPct, resolveSteadyStateAttendedPct } from "../engine/attended-occupancy";
import { d } from "../decimal";

describe("attended occupancy link", () => {
  it("links attended to booked via cancel and no-show at steady state", () => {
    const a = createSampleAssumptions();
    expect(resolveSteadyStateAttendedPct(a)).toBeCloseTo(55.29, 1);
  });

  it("scales attended with ramp booked occupancy when linked", () => {
    const a = {
      ...createSampleAssumptions(),
      attendedOccupancyMode: "linked" as const,
      preOpeningMonths: 2,
      rampUpStartingOccupancyPct: 30,
    };
    const rampOcc = getRampUpOccupancy(a, 3);
    const cap = calculateCapacity(a, rampOcc);
    expect(rampOcc.times(100).toNumber()).toBe(30);
    expect(cap.attendedSeatsMonthly.lte(cap.occupiedSeatsMonthly)).toBe(true);
    expect(cap.attendedSeatsMonthly.toNumber()).toBeCloseTo(390 * 0.2765, 0);
  });

  it("caps manual attended at booked", () => {
    const a = {
      ...createSampleAssumptions(),
      attendedOccupancyMode: "manual" as const,
      projectedAttendedOccupancyPct: 80,
      projectedBookedOccupancyPct: 40,
    };
    expect(resolveAttendedOccupancyPct(a, 40)).toBe(40);
    const cap = calculateCapacity(a, d(0.4));
    expect(cap.attendedSeatsMonthly.lte(cap.occupiedSeatsMonthly)).toBe(true);
  });
});
