/**
 * Credit Health — outstanding obligations vs eligible flexible capacity.
 */
import Decimal from "decimal.js";
import { d } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import type { CapacityResult } from "./capacity";
import {
  buildCreditLedgerFromAssumptions,
  deriveExpectedFutureRedemptions,
  deriveOutstandingCredits,
} from "./credit-ledger";
import { listFlexiblePacks, analyzeFlexiblePack } from "./flexible-packs";
import { totalStandingSpotCommittedSeatsMonthly } from "./standing-spots";
import { calculateCommercialPackSales } from "./commercial-pack-sales";

export interface CreditHealthWarning {
  code:
    | "peak_capacity_pressure"
    | "expiry_cliff"
    | "standing_concentration"
    | "low_coverage"
    | "aggressive_presale";
  severity: "info" | "caution" | "pressure";
  title: string;
  message: string;
}

export interface CreditHealthResult {
  creditsSold: Decimal;
  creditsRedeemed: Decimal;
  creditsOutstanding: Decimal;
  creditsNearingExpiry: Decimal;
  expectedRedemptionsNext2Weeks: Decimal;
  expectedRedemptionsNext4Weeks: Decimal;
  eligibleFlexibleCapacity: Decimal;
  eligiblePeakFlexibleCapacity: Decimal;
  overallRedemptionCoverage: Decimal;
  peakRedemptionCoverage: Decimal;
  expiryCliffRiskPct: Decimal;
  warnings: CreditHealthWarning[];
  plainEnglishSummary: string;
}

export function calculateCreditHealth(
  assumptions: FinanceAssumptions,
  capacity: CapacityResult
): CreditHealthResult {
  const ledger = buildCreditLedgerFromAssumptions(assumptions);
  const outstanding = deriveOutstandingCredits(assumptions);
  const expectedFutureRedemptions = deriveExpectedFutureRedemptions(assumptions);

  const standingCommitted = totalStandingSpotCommittedSeatsMonthly(assumptions);
  const eligibleFlexible = Decimal.max(
    0,
    capacity.monthlyAvailableSeats.minus(standingCommitted)
  );
  const peakShare = d(assumptions.peakSlotsShareOfCapacityPct).dividedBy(100);
  const eligiblePeakFlexible = eligibleFlexible.times(peakShare);

  const overallCoverage = expectedFutureRedemptions.isZero()
    ? new Decimal(999)
    : eligibleFlexible.dividedBy(expectedFutureRedemptions);

  const peakRedemptionShare = listFlexiblePacks(assumptions).length > 0
    ? d(
        listFlexiblePacks(assumptions).reduce(
          (s, p) =>
            s +
            (p.packRules?.expectedPeakBookingSharePct ??
              p.expectedRedemptionRatePct ??
              50) *
              p.packageMixPct,
          0
        ) / Math.max(1, listFlexiblePacks(assumptions).reduce((s, p) => s + p.packageMixPct, 0))
      ).dividedBy(100)
    : peakShare;

  const expectedPeakRedemptions = expectedFutureRedemptions.times(peakRedemptionShare);
  const peakCoverage = expectedPeakRedemptions.isZero()
    ? new Decimal(999)
    : eligiblePeakFlexible.dividedBy(expectedPeakRedemptions);

  let expiryCliff = d(0);
  for (const pack of listFlexiblePacks(assumptions)) {
    const econ = analyzeFlexiblePack(pack, assumptions);
    expiryCliff = expiryCliff.plus(econ.expiryCliffRiskPct.times(pack.packageMixPct).dividedBy(100));
  }

  const weeksPerMonth = d(52).dividedBy(12);
  const expectedRedemptionsNext2Weeks = expectedFutureRedemptions.times(2).dividedBy(weeksPerMonth.times(4));
  const expectedRedemptionsNext4Weeks = expectedFutureRedemptions.times(4).dividedBy(weeksPerMonth.times(4));

  const warnings: CreditHealthWarning[] = [];

  if (peakCoverage.lt(1.2) && expectedPeakRedemptions.gt(0)) {
    warnings.push({
      code: "peak_capacity_pressure",
      severity: peakCoverage.lt(1) ? "pressure" : "caution",
      title: "Peak capacity pressure",
      message: `Overall capacity may be sufficient, but expected peak-time redemptions (${expectedPeakRedemptions.toFixed(0)} sessions/mo) are approaching available peak flexible capacity (${eligiblePeakFlexible.toFixed(0)} sessions/mo). Coverage: ${peakCoverage.toFixed(2)}×.`,
    });
  }

  const bookedPct = capacity.occupiedSeatsMonthly.isZero()
    ? assumptions.rampUpStartingOccupancyPct
    : capacity.occupiedSeatsMonthly
        .dividedBy(capacity.monthlyAvailableSeats)
        .times(100)
        .toNumber();
  const commercial = calculateCommercialPackSales(assumptions, bookedPct);
  const uncommitted = Decimal.max(
    0,
    capacity.monthlyAvailableSeats.minus(capacity.occupiedSeatsMonthly).minus(standingCommitted)
  );

  if (commercial.multiplier.gt(1)) {
    warnings.push({
      code: "aggressive_presale",
      severity: "caution",
      title: "Aggressive pack pre-sale during ramp",
      message: `Pack sales volume is ×${commercial.multiplier.toFixed(2)} while booked occupancy is ${bookedPct.toFixed(0)}% (target ${assumptions.projectedBookedOccupancyPct}%). Cash and P&L include purchase-time revenue — plan delivery capacity for ${commercial.totalNewCredits.toFixed(0)} new credits this month.`,
    });
  }

  if (
    commercial.totalNewCredits.gt(0) &&
    commercial.totalNewCredits.gt(uncommitted)
  ) {
    warnings.push({
      code: "aggressive_presale",
      severity: "pressure",
      title: "Pre-sales exceed open capacity",
      message: `New pack sales add ${commercial.totalNewCredits.toFixed(0)} credits vs ${uncommitted.toFixed(0)} uncommitted spots this month — you may be selling ahead of delivery capacity.`,
    });
  }

  if (overallCoverage.lt(1) && outstanding.gt(0)) {
    warnings.push({
      code: "low_coverage",
      severity: "pressure",
      title: "Redemption coverage below 1×",
      message: `Expected future redemptions (${expectedFutureRedemptions.toFixed(0)}) exceed eligible uncommitted flexible capacity (${eligibleFlexible.toFixed(0)}).`,
    });
  }

  const standingPct = capacity.monthlyAvailableSeats.isZero()
    ? d(0)
    : standingCommitted.dividedBy(capacity.monthlyAvailableSeats).times(100);
  if (standingPct.gt(40)) {
    warnings.push({
      code: "standing_concentration",
      severity: "info",
      title: "Standing concentration",
      message: `Standing reservations occupy ${standingPct.toFixed(0)}% of monthly physical capacity, reducing flexible inventory.`,
    });
  }

  return {
    creditsSold: ledger.totals.creditsPurchased,
    creditsRedeemed: ledger.totals.creditsRedeemed,
    creditsOutstanding: outstanding,
    creditsNearingExpiry: ledger.totals.creditsExpired,
    expectedRedemptionsNext2Weeks,
    expectedRedemptionsNext4Weeks,
    eligibleFlexibleCapacity: eligibleFlexible,
    eligiblePeakFlexibleCapacity: eligiblePeakFlexible,
    overallRedemptionCoverage: overallCoverage,
    peakRedemptionCoverage: peakCoverage,
    expiryCliffRiskPct: expiryCliff,
    warnings,
    plainEnglishSummary:
      outstanding.gt(0)
        ? `${outstanding.toFixed(0)} outstanding credits is normal for prepaid packs. Overall redemption coverage is ${overallCoverage.toFixed(2)}×; peak coverage is ${peakCoverage.toFixed(2)}×.`
        : "No outstanding credit obligations modelled yet. Configure pack sales volume or manual outstanding credits in assumptions.",
  };
}
