import { d, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, Product } from "../schemas";
import Decimal from "decimal.js";
import {
  calculateWeightedRealisedRevenue,
  productNetPrice,
} from "./revenue";
import { contributionPerSession } from "./contribution";

export interface StandbyAccessSimulation {
  availableStandbyInventory: Decimal;
  expectedClaims: Decimal;
  standbyNetRevenue: Decimal;
  standbyContribution: Decimal;
  estimatedDisplacedRegularContribution: Decimal;
  netIncrementalContribution: Decimal;
  occupancyImprovement: Decimal;
  breakEvenCannibalisationPct: Decimal;
  breakEvenExplanation: string;
  /** @deprecated Use estimatedDisplacedRegularContribution */
  estimatedCannibalisedContribution: Decimal;
  /** @deprecated Use netIncrementalContribution */
  incrementalAfterCannibalisation: Decimal;
  cannibalisationPct: Decimal;
  warning: string;
  traces: Record<string, CalculationTrace>;
}

export function simulateStandbyAccessEconomics(
  assumptions: FinanceAssumptions,
  standbyProduct: Product
): StandbyAccessSimulation {
  const weighted = calculateWeightedRealisedRevenue(assumptions);
  const netStandby = productNetPrice(standbyProduct, assumptions);
  const standbyContributionPerClaim = contributionPerSession(
    assumptions,
    netStandby
  );

  const availableInventory = d(
    standbyProduct.standbyExpectedAvailableEmptySeats ?? 40
  );
  const claimRate = d(standbyProduct.standbyExpectedClaimRatePct ?? 50).dividedBy(
    100
  );
  const attendanceRate = d(
    standbyProduct.standbyAttendanceRatePct ?? 90
  ).dividedBy(100);
  const expectedClaims = availableInventory.times(claimRate);
  const attendedClaims = expectedClaims.times(attendanceRate);

  const regularContributionPerSession = d(
    standbyProduct.standbyRegularContributionPerSession ??
      contributionPerSession(
        assumptions,
        weighted.weightedNetRevenuePerCredit
      ).toNumber()
  );

  const cannibalisationPct = d(
    standbyProduct.standbyCannibalisationPct ?? 30
  ).dividedBy(100);
  const estimatedDisplacedRegularContribution =
    regularContributionPerSession.times(cannibalisationPct).times(expectedClaims);

  const standbyContribution = standbyContributionPerClaim.times(attendedClaims);
  const standbyNetRevenue = netStandby.times(attendedClaims);
  const netIncrementalContribution = standbyContribution.minus(
    estimatedDisplacedRegularContribution
  );

  const breakEvenCannibalisationPct = regularContributionPerSession.isZero()
    ? new Decimal(0)
    : standbyContributionPerClaim
        .dividedBy(regularContributionPerSession)
        .times(100);

  const breakEvenExplanation = `If more than ${breakEvenCannibalisationPct.toFixed(0)}% of Standby claims would otherwise have purchased regular flexible access at ${regularContributionPerSession.toFixed(0)} contribution/session, Standby stops adding positive incremental contribution. This is a planning threshold based on your cannibalisation assumption — not certain lost revenue.`;

  return {
    availableStandbyInventory: availableInventory,
    expectedClaims,
    standbyNetRevenue,
    standbyContribution,
    estimatedDisplacedRegularContribution,
    netIncrementalContribution,
    occupancyImprovement: attendedClaims,
    breakEvenCannibalisationPct,
    breakEvenExplanation,
    estimatedCannibalisedContribution: estimatedDisplacedRegularContribution,
    incrementalAfterCannibalisation: netIncrementalContribution,
    cannibalisationPct: cannibalisationPct.times(100),
    warning:
      "Standby must only access otherwise unsold capacity. Cannibalisation is an estimate — confirm with booking data.",
    traces: {
      incremental: trace(
        "Net incremental Standby contribution",
        "standby contribution − estimated displaced regular contribution",
        "INR/month",
        [
          {
            label: "Standby contribution",
            expression: standbyContribution.toString(),
            result: standbyContribution,
          },
          {
            label: "Estimated displaced regular contribution",
            expression: estimatedDisplacedRegularContribution.toString(),
            result: estimatedDisplacedRegularContribution,
          },
        ],
        netIncrementalContribution
      ),
    },
  };
}
