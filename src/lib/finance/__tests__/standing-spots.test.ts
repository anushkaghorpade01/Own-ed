import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { calculateCapacity } from "../engine/capacity";
import { calculateRevenue } from "../engine/revenue";
import {
  analyzeStandingSpotReservations,
  standingSpotCommittedSeatsPerMonth,
  totalStandingSpotCommittedSeatsMonthly,
  hasStandingSpotFutureCommitment,
  STANDING_SPOT_EXPLAINER,
} from "../engine/standing-spots";

describe("Standing Spot reservation model", () => {
  const assumptions = createSampleAssumptions();
  const capacity = calculateCapacity(assumptions);
  const standingSpot = assumptions.products.find((p) => p.type === "standing_spot")!;

  it("includes the reservation product explainer", () => {
    expect(STANDING_SPOT_EXPLAINER).toContain("reservation product");
    expect(STANDING_SPOT_EXPLAINER).toContain("flexible members");
  });

  it("calculates committed seats per month from calendar recurringSlots", () => {
    const committed = standingSpotCommittedSeatsPerMonth(standingSpot, assumptions);
    // Tue + Thu slots in current month via calendar (typically 8–10, not weekly × 4.33)
    expect(committed.toNumber()).toBeGreaterThanOrEqual(8);
    expect(committed.toNumber()).toBeLessThanOrEqual(10);
  });

  it("does not treat standing spot as inherently more predictable than prepaid packs without commitment", () => {
    const oneTime = {
      ...standingSpot,
      standingSpotRecurringSubscription: false,
      recurring: false,
      standingSpotMinCommitmentMonths: 0,
    };
    expect(hasStandingSpotFutureCommitment(oneTime)).toBe(false);

    const analysis = analyzeStandingSpotReservations(assumptions, capacity.monthlyAvailableSeats)[0];
    expect(analysis.hasFutureRevenueVisibility).toBe(true);
    // Base launch uses 1-month commitment — no multi-month future contract
    expect(analysis.futureContractedRevenue).toBeNull();
  });

  it("reports committed monthly revenue instead of guaranteed revenue", () => {
    const [analysis] = analyzeStandingSpotReservations(
      assumptions,
      capacity.monthlyAvailableSeats
    );
    expect(analysis.committedMonthlyRevenue.gt(0)).toBe(true);
    expect(analysis.flexibleInventorySacrificed.toNumber()).toBeGreaterThanOrEqual(8);
    expect(analysis.remainingFlexibleSeatsPerClass.toNumber()).toBe(2);
    expect(analysis.committedOccupancyBeforeFlexiblePct.toFixed(0)).toBe("33");
  });

  it("allocates flexible revenue via service demand mix", () => {
    const occupied = capacity.occupiedSeatsMonthly;
    const revenue = calculateRevenue(assumptions, occupied);

    expect(revenue.groupClassRevenue.gt(0)).toBe(true);
    expect(revenue.sessionAllocation.flexibleCreditSessions.gt(0)).toBe(true);
    expect(revenue.standingSpotRevenue.toNumber()).toBe(0);
    expect(revenue.productLevel.length).toBeGreaterThan(0);

    const productRevenueSum = revenue.productLevel
      .filter((p) => p.productType !== "standing_spot")
      .reduce((s, p) => s + p.netRevenue.toNumber(), 0);

    expect(
      revenue.netRevenue.toFixed(0)
    ).toBe(
      revenue.groupClassRevenue
        .plus(revenue.standingSpotRevenue)
        .plus(revenue.standbyRevenue)
        .plus(revenue.privateRevenue)
        .plus(revenue.duoRevenue)
        .plus(revenue.workshopRevenue)
        .plus(revenue.otherRevenue)
        .toFixed(0)
    );
    expect(productRevenueSum).toBeGreaterThan(0);
  });

  it("calculates future contracted revenue only with minimum commitment", () => {
    const noCommitment = {
      ...assumptions,
      products: assumptions.products.map((p) =>
        p.type === "standing_spot"
          ? {
              ...p,
              standingSpotRecurringSubscription: true,
              standingSpotMinCommitmentMonths: 0,
            }
          : p
      ),
    };
    const [openEnded] = analyzeStandingSpotReservations(
      noCommitment,
      capacity.monthlyAvailableSeats
    );
    expect(openEnded.hasFutureRevenueVisibility).toBe(true);
    expect(openEnded.futureContractedRevenue).toBeNull();

    const [fixed] = analyzeStandingSpotReservations(
      {
        ...assumptions,
        products: assumptions.products.map((p) =>
          p.type === "standing_spot"
            ? { ...p, standingSpotMinCommitmentMonths: 3 }
            : p
        ),
      },
      capacity.monthlyAvailableSeats
    );
    expect(fixed.futureContractedRevenue).not.toBeNull();
    expect(fixed.futureContractedRevenue!.toNumber()).toBeCloseTo(
      fixed.committedMonthlyRevenue.times(2).toNumber(),
      0
    );
  });

  it("compares premium/discount versus weighted credit pack", () => {
    const [analysis] = analyzeStandingSpotReservations(
      assumptions,
      capacity.monthlyAvailableSeats
    );
    expect(analysis.comparableCreditPackNetPerClass.gt(0)).toBe(true);
    expect(analysis.premiumDiscountVsCreditPack.toNumber()).not.toBeNaN();
  });
});
