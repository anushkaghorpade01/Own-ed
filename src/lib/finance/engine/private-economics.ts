/**
 * Private session economics — contribution, price floor, opportunity cost.
 */
import Decimal from "decimal.js";
import { d, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, Product } from "../schemas";
import {
  stripGst,
  getEffectiveGstModeForAssumptions,
  productNetPrice,
} from "./product-pricing";
import { calculateGroupWeightedNetSalesFromServiceMix } from "./service-booking-economics";
import { getPrivateProduct, splitServiceDemandSpots } from "./service-demand-mix";
import { calculateCapacity } from "./capacity";

export function privateReformersCapacityConsumed(
  assumptions: FinanceAssumptions,
  privateProduct?: Product
): Decimal {
  if (assumptions.privateRequiresExclusiveStudio) {
    return d(assumptions.reformers);
  }
  const rules = privateProduct?.privateRules;
  return d(rules?.reformersOccupied ?? assumptions.privateReformersOccupied ?? 1);
}

export interface PrivateEconomicsResult {
  grossRevenuePerSession: Decimal;
  netRevenuePerSession: Decimal;
  directVariableCostPerSession: Decimal;
  contributionPerSession: Decimal;
  contributionPerInstructorHour: Decimal;
  contributionPerReformerHour: Decimal;
  economicPriceFloor: Decimal;
  premiumVsFlexibleGroupPct: Decimal;
  opportunityCostVsGroup: Decimal;
  incrementalVsAlternative: Decimal;
  slotBand: "peak" | "standard" | "off_peak";
  alternativeGroupContribution: Decimal;
  insight: string;
  trace: CalculationTrace;
}

function paymentFee(assumptions: FinanceAssumptions, net: Decimal): Decimal {
  return net
    .times(d(assumptions.paymentGatewayPct).dividedBy(100))
    .plus(d(assumptions.paymentGatewayFixedFee ?? 0));
}

function groupContributionPerSpot(
  assumptions: FinanceAssumptions,
  netPerCredit: Decimal
): Decimal {
  const consumables = d(assumptions.sessionConsumables);
  const instructor =
    d(assumptions.instructorPerClassPayout).dividedBy(assumptions.maxGroupClassSize).plus(
      d(assumptions.instructorPerAttendeePayout)
    );
  const fee = paymentFee(assumptions, netPerCredit);
  return netPerCredit.minus(consumables).minus(instructor).minus(fee);
}

export function privateSessionConsumables(
  assumptions: FinanceAssumptions,
  product?: Product
): Decimal {
  const privateProduct = product ?? getPrivateProduct(assumptions);
  if (!privateProduct) return new Decimal(0);
  const rules = privateProduct.privateRules;
  return d(rules?.otherDirectVariableCost ?? assumptions.sessionConsumables);
}

export function privateDirectVariableCostPerSession(
  assumptions: FinanceAssumptions,
  product?: Product
): Decimal {
  const privateProduct =
    product ?? getPrivateProduct(assumptions);
  if (!privateProduct) return new Decimal(0);
  const rules = privateProduct.privateRules;
  const durationMin = rules?.durationMinutes ?? assumptions.privateDurationMinutes ?? 55;
  const durationHours = d(durationMin).dividedBy(60);
  const consumables = d(rules?.otherDirectVariableCost ?? assumptions.sessionConsumables);

  let instructorVariable = new Decimal(0);
  if (rules?.instructorCostPerHour != null && rules.instructorCostPerHour > 0) {
    instructorVariable = d(rules.instructorCostPerHour).times(durationHours);
  } else if (assumptions.privateInstructorCost > 0) {
    instructorVariable = d(assumptions.privateInstructorCost);
  } else if (
    assumptions.instructorPerClassPayout > 0 ||
    assumptions.instructorPerAttendeePayout > 0
  ) {
    const clients = d(rules?.clientsPerSession ?? 1);
    instructorVariable = d(assumptions.instructorPerClassPayout).plus(
      d(assumptions.instructorPerAttendeePayout).times(clients)
    );
  }

  return instructorVariable.plus(consumables);
}

export function analyzePrivateEconomics(
  assumptions: FinanceAssumptions,
  slotBand: "peak" | "standard" | "off_peak" = "standard"
): PrivateEconomicsResult {
  const privateProduct = getPrivateProduct(assumptions);
  const price = privateProduct?.price ?? assumptions.privatePrice;
  const rules = privateProduct?.privateRules;
  const durationMin = rules?.durationMinutes ?? assumptions.privateDurationMinutes ?? 55;
  const durationHours = d(durationMin).dividedBy(60);
  const reformers = privateReformersCapacityConsumed(assumptions, privateProduct);
  const clients = d(rules?.clientsPerSession ?? 1);

  const mode = getEffectiveGstModeForAssumptions(assumptions);
  const gross = d(price);
  const net = privateProduct
    ? productNetPrice(privateProduct, assumptions)
    : stripGst(gross, assumptions.gstRatePct, mode).net;

  const instructorCost = privateDirectVariableCostPerSession(assumptions, privateProduct);
  const otherDirect = new Decimal(0);
  const directVariable = instructorCost;
  const fee = paymentFee(assumptions, net);
  const contribution = net.minus(directVariable).minus(fee);

  const flexNet = calculateGroupWeightedNetSalesFromServiceMix(assumptions);

  // Slot-aware alternative group contribution
  const bandMultiplier =
    slotBand === "peak" ? 1.15 : slotBand === "off_peak" ? 0.85 : 1;
  const alternativeGroupContribution = groupContributionPerSpot(
    assumptions,
    flexNet.times(bandMultiplier)
  ).times(reformers);

  const economicPriceFloor = alternativeGroupContribution
    .plus(directVariable)
    .plus(fee);

  const premiumVsFlexible =
    flexNet.isZero() ? new Decimal(0) : net.minus(flexNet).dividedBy(flexNet).times(100);

  const incrementalVsAlternative = contribution.minus(alternativeGroupContribution);
  const opportunityCost = Decimal.max(0, alternativeGroupContribution.minus(contribution));

  let insight: string;
  if (incrementalVsAlternative.gt(0)) {
    insight = `Private adds approximately ${incrementalVsAlternative.toFixed(0)} expected contribution versus the likely alternative group use in this ${slotBand} slot.`;
  } else if (incrementalVsAlternative.lt(0)) {
    insight = `Private is profitable in isolation but has approximately ${opportunityCost.toFixed(0)} opportunity cost compared with expected group usage in this ${slotBand} slot.`;
  } else {
    insight = "Private contribution matches expected alternative group use for this slot band.";
  }

  return {
    grossRevenuePerSession: gross,
    netRevenuePerSession: net,
    directVariableCostPerSession: directVariable,
    contributionPerSession: contribution,
    contributionPerInstructorHour: durationHours.isZero()
      ? new Decimal(0)
      : contribution.dividedBy(durationHours),
    contributionPerReformerHour: durationHours.isZero()
      ? new Decimal(0)
      : contribution.dividedBy(durationHours.times(reformers)),
    economicPriceFloor,
    premiumVsFlexibleGroupPct: premiumVsFlexible,
    opportunityCostVsGroup: opportunityCost,
    incrementalVsAlternative,
    slotBand,
    alternativeGroupContribution,
    insight,
    trace: trace(
      "Private economics",
      "Net session revenue − direct costs − payment fee",
      "INR/session",
      [
        { label: "Net revenue", expression: net.toString(), result: net },
        { label: "Direct variable", expression: directVariable.toString(), result: directVariable },
        { label: "Contribution", expression: contribution.toString(), result: contribution },
        {
          label: "Alternative group",
          expression: alternativeGroupContribution.toString(),
          result: alternativeGroupContribution,
        },
      ],
      contribution
    ),
  };
}

export function estimatePrivateSessionsFromMix(
  assumptions: FinanceAssumptions
): Decimal {
  const occupancy = d(assumptions.projectedBookedOccupancyPct).dividedBy(100);
  const capacity = calculateCapacity(assumptions, occupancy);
  const split = splitServiceDemandSpots(assumptions, capacity.occupiedSeatsMonthly);
  // 1 private session ≈ 1 reformer spot consumed (may block studio if exclusive)
  return split.privateSpots;
}

export function privateContributionPerSession(
  assumptions: FinanceAssumptions
): Decimal {
  return analyzePrivateEconomics(assumptions).contributionPerSession;
}
