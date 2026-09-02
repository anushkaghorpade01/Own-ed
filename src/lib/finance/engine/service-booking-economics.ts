/**
 * Service booking mix economics — canonical demand model.
 *
 * Service demand mix % = share of occupied reformer bookings (not customer count).
 * Primary operating assumption for revenue, contribution, and blended unit metrics.
 */
import Decimal from "decimal.js";
import { d, sum, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, Product } from "../schemas";
import { analyzeFlexiblePack } from "./flexible-packs";
import { contributionPerSession } from "./contribution";
import { productNetPrice, productNetRevenuePerCredit } from "./product-pricing";
import {
  getServiceDemandPct,
  listBaseCaseMixProducts,
  type BaseCaseMixProduct,
} from "./service-demand-mix";

export interface ServiceBookingRow {
  product: BaseCaseMixProduct;
  serviceBookingMixPct: Decimal;
  netSalesPerOccupiedBooking: Decimal;
  weightedNetSalesImpact: Decimal;
  contributionPerOccupiedBooking: Decimal;
  weightedContributionImpact: Decimal;
}

export interface ServiceBookingEconomicsResult {
  rows: ServiceBookingRow[];
  mixTotal: Decimal;
  mixValid: boolean;
  /** Drop-In + credit packs only — per occupied flexible booking (mix normalized to 100% within flexible) */
  weightedGroupNetSalesPerOccupiedSpot: Decimal;
  /** Drop-In + credit packs only — per occupied flexible booking */
  weightedGroupContributionPerOccupiedSpot: Decimal;
  /** All base-case services including Private */
  blendedNetSalesPerOccupiedSpot: Decimal;
  blendedContributionPerOccupiedSpot: Decimal;
  trace: CalculationTrace;
}

export interface ServiceBookingAllocation {
  product: BaseCaseMixProduct;
  serviceBookingMixPct: Decimal;
  occupiedBookings: Decimal;
}

function netSalesPerOccupiedBooking(
  product: Product,
  assumptions: FinanceAssumptions
): Decimal {
  if (product.type === "private") {
    return productNetPrice(product, assumptions);
  }
  if (product.type === "drop_in" || product.type === "credit_pack") {
    return productNetRevenuePerCredit(product, assumptions);
  }
  return productNetPrice(product, assumptions);
}

function privateContributionPerBooking(
  product: Product,
  assumptions: FinanceAssumptions
): Decimal {
  const net = productNetPrice(product, assumptions);
  const rules = product.privateRules;
  const durationMin = rules?.durationMinutes ?? assumptions.privateDurationMinutes ?? 55;
  const durationHours = d(durationMin).dividedBy(60);
  const clients = d(rules?.clientsPerSession ?? 1);
  const instructorPerHour =
    rules?.instructorCostPerHour != null && rules.instructorCostPerHour > 0
      ? d(rules.instructorCostPerHour)
      : d(assumptions.instructorPerClassPayout)
          .plus(d(assumptions.instructorPerAttendeePayout).times(clients))
          .dividedBy(durationHours.isZero() ? 1 : durationHours);
  const directVariable = instructorPerHour
    .times(durationHours)
    .plus(d(rules?.otherDirectVariableCost ?? assumptions.sessionConsumables));
  const fee = net
    .times(d(assumptions.paymentGatewayPct).dividedBy(100))
    .plus(d(assumptions.paymentGatewayFixedFee ?? 0));
  return net.minus(directVariable).minus(fee);
}

function contributionPerOccupiedBooking(
  product: Product,
  assumptions: FinanceAssumptions,
  netSales: Decimal
): Decimal {
  if (product.type === "private") {
    return privateContributionPerBooking(product, assumptions);
  }
  return contributionPerSession(assumptions, netSales);
}

function isFlexibleGroupProduct(product: BaseCaseMixProduct): boolean {
  return product.type === "drop_in" || product.type === "credit_pack";
}

/** Normalize a flexible-only weighted sum to per occupied flexible booking. */
function normalizeFlexiblePerOccupiedSpot(
  weightedSum: Decimal,
  flexibleMixPctTotal: Decimal
): Decimal {
  if (flexibleMixPctTotal.isZero()) return new Decimal(0);
  return weightedSum.dividedBy(flexibleMixPctTotal.dividedBy(100));
}

/** Group/flexible weighted net sales per occupied flexible booking — Private excluded */
export function calculateGroupWeightedNetSalesFromServiceMix(
  assumptions: FinanceAssumptions
): Decimal {
  const groupProducts = listBaseCaseMixProducts(assumptions).filter(isFlexibleGroupProduct);
  const flexibleMixTotal = sum(groupProducts.map((p) => d(getServiceDemandPct(p))));
  const weightedSum = sum(
    groupProducts.map((product) => {
      const weight = d(getServiceDemandPct(product)).dividedBy(100);
      return weight.times(netSalesPerOccupiedBooking(product, assumptions));
    })
  );
  return normalizeFlexiblePerOccupiedSpot(weightedSum, flexibleMixTotal);
}

export function calculateServiceBookingEconomics(
  assumptions: FinanceAssumptions
): ServiceBookingEconomicsResult {
  const products = listBaseCaseMixProducts(assumptions);
  const mixTotal = sum(products.map((p) => d(getServiceDemandPct(p))));

  const rows: ServiceBookingRow[] = products.map((product) => {
    const mixPct = d(getServiceDemandPct(product));
    const weight = mixPct.dividedBy(100);
    const netSales = netSalesPerOccupiedBooking(product, assumptions);
    const contribution = contributionPerOccupiedBooking(product, assumptions, netSales);

    return {
      product,
      serviceBookingMixPct: mixPct,
      netSalesPerOccupiedBooking: netSales,
      weightedNetSalesImpact: weight.times(netSales),
      contributionPerOccupiedBooking: contribution,
      weightedContributionImpact: weight.times(contribution),
    };
  });

  const groupRows = rows.filter((r) => isFlexibleGroupProduct(r.product));
  const flexibleMixTotal = sum(groupRows.map((r) => r.serviceBookingMixPct));
  const flexibleNetSalesWeighted = sum(groupRows.map((r) => r.weightedNetSalesImpact));
  const flexibleContributionWeighted = sum(
    groupRows.map((r) => r.weightedContributionImpact)
  );
  const weightedGroupNetSalesPerOccupiedSpot = normalizeFlexiblePerOccupiedSpot(
    flexibleNetSalesWeighted,
    flexibleMixTotal
  );
  const weightedGroupContributionPerOccupiedSpot = normalizeFlexiblePerOccupiedSpot(
    flexibleContributionWeighted,
    flexibleMixTotal
  );
  const blendedNetSalesPerOccupiedSpot = sum(rows.map((r) => r.weightedNetSalesImpact));
  const blendedContributionPerOccupiedSpot = sum(
    rows.map((r) => r.weightedContributionImpact)
  );

  const steps = rows.map((r) => ({
    label: r.product.name,
    expression: `${r.serviceBookingMixPct.toFixed(1)}% × ${r.netSalesPerOccupiedBooking.toFixed(2)} net/booking`,
    result: r.weightedNetSalesImpact,
  }));

  return {
    rows,
    mixTotal,
    mixValid: mixTotal.equals(100),
    weightedGroupNetSalesPerOccupiedSpot,
    weightedGroupContributionPerOccupiedSpot,
    blendedNetSalesPerOccupiedSpot,
    blendedContributionPerOccupiedSpot,
    trace: trace(
      "Blended net sales per occupied reformer booking",
      "Σ (service booking mix % × net sales per occupied booking)",
      "INR/booking",
      steps,
      blendedNetSalesPerOccupiedSpot
    ),
  };
}

/** Allocate occupied reformer bookings by service demand mix */
export function allocateOccupiedBookingsByServiceDemand(
  assumptions: FinanceAssumptions,
  totalOccupiedSpots: Decimal
): ServiceBookingAllocation[] {
  return listBaseCaseMixProducts(assumptions).map((product) => {
    const mixPct = d(getServiceDemandPct(product));
    return {
      product,
      serviceBookingMixPct: mixPct,
      occupiedBookings: totalOccupiedSpots.times(mixPct.dividedBy(100)),
    };
  });
}

/** @deprecated Pack-level credit mix — not used for core revenue when service mix is canonical */
export function calculateFlexibleCreditMixFromServiceMix(
  assumptions: FinanceAssumptions
) {
  const flex = listBaseCaseMixProducts(assumptions).filter(
    (p) => p.type === "drop_in" || p.type === "credit_pack"
  );
  const flexMixTotal = sum(flex.map((p) => d(getServiceDemandPct(p))));
  return flex.map((product) => {
    const servicePct = d(getServiceDemandPct(product));
    const creditMixPct = flexMixTotal.isZero()
      ? new Decimal(0)
      : servicePct.dividedBy(flexMixTotal).times(100);
    const pricing = analyzeFlexiblePack(product, assumptions);
    return {
      product,
      serviceBookingMixPct: servicePct,
      flexibleCreditMixPct: creditMixPct,
      netPerCredit: pricing.netPerCredit,
    };
  });
}
