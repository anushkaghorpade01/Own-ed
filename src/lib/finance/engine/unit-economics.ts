import { d, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import type { RevenueResult } from "./revenue";
import type { DirectCostsResult, OperatingExpensesResult } from "./costs";
import type { CommercialPackSalesResult } from "./commercial-pack-sales";
import Decimal from "decimal.js";

export interface PerSeatEconomics {
  netRevenuePerAttendee: Decimal;
  paymentProcessing: Decimal;
  consumables: Decimal;
  variableInstructorCost: Decimal;
  otherDirectVariable: Decimal;
  contributionMarginPerSeat: Decimal;
  trace: CalculationTrace;
}

export interface PerClassEconomics {
  occupancy: number;
  capacity: number;
  grossBookings: Decimal;
  gst: Decimal;
  netRevenue: Decimal;
  directVariableCosts: Decimal;
  instructorVariableCost: Decimal;
  contributionMargin: Decimal;
  allocatedFixedOverhead: Decimal;
  fullyLoadedProfit: Decimal;
}

export interface UnitEconomicsResult {
  perSeat: PerSeatEconomics;
  perClass: PerClassEconomics[];
  perReformer: {
    revenuePerReformer: Decimal;
    contributionPerReformer: Decimal;
    utilisationPct: Decimal;
  };
  traces: Record<string, CalculationTrace>;
}

export function calculateUnitEconomics(
  assumptions: FinanceAssumptions,
  revenue: RevenueResult,
  directCosts: DirectCostsResult,
  operatingExpenses: OperatingExpensesResult,
  attendedSeatsMonthly: Decimal,
  monthlyAvailableSeats: Decimal
): UnitEconomicsResult {
  const blendedNet = revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot;
  const blendedContribution = revenue.weightedRevenue.blendedContributionPerOccupiedSpot;

  const avgNetPerSeat = attendedSeatsMonthly.isZero()
    ? blendedNet
    : revenue.netRevenue.dividedBy(attendedSeatsMonthly);

  const paymentPerSeat = avgNetPerSeat.times(
    d(assumptions.paymentGatewayPct).dividedBy(100)
  );
  const consumables = d(assumptions.sessionConsumables);
  const variableInstructor =
    d(assumptions.instructorPerClassPayout).dividedBy(
      assumptions.maxGroupClassSize
    ).plus(d(assumptions.instructorPerAttendeePayout));

  const contributionMarginPerSeat = attendedSeatsMonthly.isZero()
    ? blendedContribution
    : blendedContribution;

  const perClass: PerClassEconomics[] = [];
  const capacity = assumptions.maxGroupClassSize;

  for (let occ = 0; occ <= capacity; occ++) {
    const netRevenue = d(occ).times(revenue.weightedRevenue.blendedNetSalesPerOccupiedSpot);
    const gst = assumptions.gstRegistered
      ? netRevenue.times(d(assumptions.gstRatePct).dividedBy(100))
      : new Decimal(0);
    const instructorVar = d(assumptions.instructorPerClassPayout).plus(
      d(assumptions.instructorPerAttendeePayout).times(occ)
    );
    const directVar = d(assumptions.sessionConsumables)
      .times(occ)
      .plus(netRevenue.times(d(assumptions.paymentGatewayPct).dividedBy(100)));
    const contribution = netRevenue.minus(directVar).minus(instructorVar);
    const allocatedFixed = operatingExpenses.totalFixedCosts.dividedBy(
      assumptions.classesPerDay * assumptions.operatingDaysPerWeek * (52 / 12)
    );

    perClass.push({
      occupancy: occ,
      capacity,
      grossBookings: netRevenue.plus(gst),
      gst,
      netRevenue,
      directVariableCosts: directVar,
      instructorVariableCost: instructorVar,
      contributionMargin: contribution,
      allocatedFixedOverhead: allocatedFixed,
      fullyLoadedProfit: contribution.minus(allocatedFixed),
    });
  }

  const reformers = d(assumptions.reformers);
  const revenuePerReformer = revenue.netRevenue.dividedBy(reformers);
  const contributionPerReformer = contributionMarginPerSeat
    .times(attendedSeatsMonthly)
    .dividedBy(reformers);
  const utilisationPct = monthlyAvailableSeats.isZero()
    ? new Decimal(0)
    : attendedSeatsMonthly.dividedBy(monthlyAvailableSeats).times(100);

  return {
    perSeat: {
      netRevenuePerAttendee: avgNetPerSeat,
      paymentProcessing: paymentPerSeat,
      consumables,
      variableInstructorCost: variableInstructor,
      otherDirectVariable: new Decimal(0),
      contributionMarginPerSeat,
      trace: trace(
        "Contribution margin per occupied seat",
        "Net earned revenue per delivered seat − direct variable costs",
        "INR/seat",
        [
          { label: "Net revenue/seat", expression: avgNetPerSeat.toString(), result: avgNetPerSeat },
          { label: "Variable costs", expression: paymentPerSeat.plus(consumables).plus(variableInstructor).toString(), result: paymentPerSeat.plus(consumables).plus(variableInstructor) },
          { label: "Contribution", expression: contributionMarginPerSeat.toString(), result: contributionMarginPerSeat },
        ],
        contributionMarginPerSeat
      ),
    },
    perClass,
    perReformer: {
      revenuePerReformer,
      contributionPerReformer,
      utilisationPct,
    },
    traces: {},
  };
}

export interface CreditLiabilityResult {
  /** Total scheduled reformer spots per month */
  totalPhysicalCapacity: Decimal;
  /** Spots expected to be booked under current occupancy assumption */
  expectedOccupiedCapacity: Decimal;
  /** Physical capacity not expected to be consumed by current bookings */
  uncommittedRemainingCapacity: Decimal;
  /** Alias — scheduled spots not booked */
  unusedCapacity: Decimal;
  /** Credits sold but not yet redeemed */
  outstandingCredits: Decimal;
  /** Credits forecast to be redeemed before expiry */
  expectedRedemptionBeforeExpiry: Decimal;
  /** Credits forecast to expire unused (breakage) — separate from revenue loss */
  creditsExpectedToExpireUnused: Decimal;
  /** Remaining open capacity credit-holders could book into */
  eligibleCapacityForCredits: Decimal;
  /** Remaining open capacity in peak/eligible time slots */
  peakTimeEligibleCapacity: Decimal;
  /** Incorrect legacy metric: total physical / redemptions — kept for comparison only */
  naiveTotalCapacityCoverageRatio: Decimal;
  /** eligibleCapacity / expectedRedemptions */
  eligibleCoverageRatio: Decimal;
  /** peakTimeEligible / expectedRedemptions */
  peakCoverageRatio: Decimal;
  status: "green" | "amber" | "red";
  peakStatus: "green" | "amber" | "red";
  /** True when total capacity looks sufficient but peak/eligible slots are constrained */
  slotConstraintDetected: boolean;
  slotConstraintWarning: string | null;
  /** New credits sold this month via commercial pack volume */
  newCreditsSoldThisMonth: Decimal;
  /** True when ramp pack sales multiplier > 1 */
  aggressivePresaleActive: boolean;
  presaleWarning: string | null;
  warning: string;
  traces: Record<string, CalculationTrace>;
}

function coverageStatus(ratio: Decimal): "green" | "amber" | "red" {
  if (ratio.lt(1)) return "red";
  if (ratio.lt(1.25)) return "amber";
  return "green";
}

export function calculateCreditLiability(
  assumptions: FinanceAssumptions,
  monthlyAvailableSeats: Decimal,
  occupiedSeatsMonthly: Decimal,
  peakSlotsSharePct = 50,
  commercialPackSales?: CommercialPackSalesResult
): CreditLiabilityResult {
  const totalPhysicalCapacity = monthlyAvailableSeats;
  const expectedOccupiedCapacity = occupiedSeatsMonthly;
  const uncommittedRemainingCapacity = Decimal.max(
    totalPhysicalCapacity.minus(expectedOccupiedCapacity),
    new Decimal(0)
  );
  const unusedCapacity = uncommittedRemainingCapacity;

  const outstandingCredits = d(assumptions.creditsSoldOutstanding);
  const expectedRedemptionBeforeExpiry = d(
    assumptions.creditsExpectedRedemptionBeforeExpiry
  );
  const creditsExpectedToExpireUnused = d(
    assumptions.creditsExpectedToExpireUnused ?? 0
  );

  const eligibleCapacityForCredits = uncommittedRemainingCapacity;

  // Peak-time eligible: estimate peak physical share, apply peak occupancy, subtract expected peak bookings
  const peakPhysicalCapacity = totalPhysicalCapacity.times(
    d(peakSlotsSharePct).dividedBy(100)
  );
  const peakExpectedOccupied = peakPhysicalCapacity.times(
    d(assumptions.peakOccupancyPct).dividedBy(100)
  );
  const peakTimeEligibleCapacity = Decimal.max(
    peakPhysicalCapacity.minus(peakExpectedOccupied),
    new Decimal(0)
  );

  const naiveTotalCapacityCoverageRatio = expectedRedemptionBeforeExpiry.isZero()
    ? new Decimal(999)
    : totalPhysicalCapacity.dividedBy(expectedRedemptionBeforeExpiry);

  const eligibleCoverageRatio = expectedRedemptionBeforeExpiry.isZero()
    ? new Decimal(999)
    : eligibleCapacityForCredits.dividedBy(expectedRedemptionBeforeExpiry);

  const peakCoverageRatio = expectedRedemptionBeforeExpiry.isZero()
    ? new Decimal(999)
    : peakTimeEligibleCapacity.dividedBy(expectedRedemptionBeforeExpiry);

  const status = coverageStatus(eligibleCoverageRatio);
  const peakStatus = coverageStatus(peakCoverageRatio);

  const slotConstraintDetected =
    naiveTotalCapacityCoverageRatio.gte(1) && peakCoverageRatio.lt(1);

  let slotConstraintWarning: string | null = null;
  if (slotConstraintDetected) {
    slotConstraintWarning =
      "Total physical capacity appears sufficient, but peak/eligible time slots may still be too constrained for members to redeem credits. Evening-only members cannot use morning capacity.";
  } else if (peakCoverageRatio.lt(1)) {
    slotConstraintWarning =
      "Peak-time eligible capacity is insufficient for expected credit redemptions in constrained booking windows.";
  }

  const newCreditsSoldThisMonth = commercialPackSales?.totalNewCredits ?? new Decimal(0);
  const aggressivePresaleActive = commercialPackSales?.multiplier.gt(1) ?? false;

  let presaleWarning: string | null = null;
  if (aggressivePresaleActive && commercialPackSales) {
    presaleWarning = `Aggressive pre-sale active (×${commercialPackSales.multiplier.toFixed(2)} pack volume while booked occupancy is ${commercialPackSales.bookedOccupancyPct.toFixed(0)}% vs ${assumptions.projectedBookedOccupancyPct}% target). P&L and cash include purchase-time pack revenue — monitor credit delivery capacity.`;
  }

  if (
    newCreditsSoldThisMonth.gt(0) &&
    newCreditsSoldThisMonth.gt(uncommittedRemainingCapacity)
  ) {
    presaleWarning = [
      presaleWarning,
      `New pack sales this month add ${newCreditsSoldThisMonth.toFixed(0)} credits — above ${uncommittedRemainingCapacity.toFixed(0)} uncommitted monthly spots at current occupancy. You may be selling ahead of delivery capacity.`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  const warning =
    presaleWarning ??
    slotConstraintWarning ??
    (creditsExpectedToExpireUnused.gt(0)
      ? `${creditsExpectedToExpireUnused.toFixed(0)} credits forecast to expire unused (breakage). Accounting treatment is configurable — confirm with accountant.`
      : "Coverage ratios are forecasts based on booking eligibility assumptions. Confirm with operational data.");

  return {
    totalPhysicalCapacity,
    expectedOccupiedCapacity,
    uncommittedRemainingCapacity,
    unusedCapacity,
    outstandingCredits,
    expectedRedemptionBeforeExpiry,
    creditsExpectedToExpireUnused,
    eligibleCapacityForCredits,
    peakTimeEligibleCapacity,
    naiveTotalCapacityCoverageRatio,
    eligibleCoverageRatio,
    peakCoverageRatio,
    status,
    peakStatus,
    slotConstraintDetected,
    slotConstraintWarning,
    newCreditsSoldThisMonth,
    aggressivePresaleActive,
    presaleWarning,
    warning,
    traces: {
      eligibleCoverage: trace(
        "Eligible capacity coverage",
        "Uncommitted remaining capacity / expected credit redemptions",
        "ratio",
        [
          { label: "Total physical capacity", expression: totalPhysicalCapacity.toString(), result: totalPhysicalCapacity },
          { label: "Expected occupied", expression: expectedOccupiedCapacity.toString(), result: expectedOccupiedCapacity },
          { label: "Uncommitted remaining", expression: uncommittedRemainingCapacity.toString(), result: uncommittedRemainingCapacity },
          { label: "Expected redemptions", expression: expectedRedemptionBeforeExpiry.toString(), result: expectedRedemptionBeforeExpiry },
          { label: "Eligible coverage", expression: `${uncommittedRemainingCapacity} / ${expectedRedemptionBeforeExpiry}`, result: eligibleCoverageRatio },
        ],
        eligibleCoverageRatio
      ),
    },
  };
}

export interface UnusedCapacityAnalysis {
  totalPhysicalCapacity: Decimal;
  expectedOccupiedCapacity: Decimal;
  unusedCapacity: Decimal;
  bookedOccupancyPct: Decimal;
  avgRealisedNetRevenuePerOccupiedSpot: Decimal;
  /** Theoretical only — NOT a P&L loss */
  unrealisedRevenueOpportunity: Decimal;
  traces: Record<string, CalculationTrace>;
}

export function calculateUnusedCapacityAnalysis(
  assumptions: FinanceAssumptions,
  monthlyAvailableSeats: Decimal,
  occupiedSeatsMonthly: Decimal,
  avgRealisedNetRevenuePerOccupiedSpot: Decimal
): UnusedCapacityAnalysis {
  const unusedCapacity = Decimal.max(
    monthlyAvailableSeats.minus(occupiedSeatsMonthly),
    new Decimal(0)
  );
  const unrealisedRevenueOpportunity = unusedCapacity.times(
    avgRealisedNetRevenuePerOccupiedSpot
  );

  return {
    totalPhysicalCapacity: monthlyAvailableSeats,
    expectedOccupiedCapacity: occupiedSeatsMonthly,
    unusedCapacity,
    bookedOccupancyPct: d(assumptions.projectedBookedOccupancyPct),
    avgRealisedNetRevenuePerOccupiedSpot,
    unrealisedRevenueOpportunity,
    traces: {
      unusedCapacity: trace(
        "Unused capacity",
        "Total physical capacity − expected occupied capacity",
        "seats/month",
        [
          { label: "Physical capacity", expression: monthlyAvailableSeats.toString(), result: monthlyAvailableSeats },
          { label: "Expected occupied", expression: occupiedSeatsMonthly.toString(), result: occupiedSeatsMonthly },
          { label: "Unused", expression: `${monthlyAvailableSeats} − ${occupiedSeatsMonthly}`, result: unusedCapacity },
        ],
        unusedCapacity
      ),
      unrealisedOpportunity: trace(
        "Unrealised revenue opportunity (theoretical)",
        "Unused capacity × avg realised net revenue per occupied spot — NOT counted as loss in P&L",
        "INR/month",
        [
          { label: "Unused spots", expression: unusedCapacity.toString(), result: unusedCapacity },
          { label: "Avg net/occupied spot", expression: avgRealisedNetRevenuePerOccupiedSpot.toString(), result: avgRealisedNetRevenuePerOccupiedSpot },
          { label: "Theoretical opportunity", expression: `${unusedCapacity} × ${avgRealisedNetRevenuePerOccupiedSpot}`, result: unrealisedRevenueOpportunity },
        ],
        unrealisedRevenueOpportunity
      ),
    },
  };
}
