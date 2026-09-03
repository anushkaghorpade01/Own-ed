import { d, trace, sum, WEEKS_PER_MONTH, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, Product } from "../schemas";
import Decimal from "decimal.js";
import {
  calculateCommittedStandingSpotMonthlyRevenue,
  totalStandingSpotCommittedSeatsMonthly,
} from "./standing-spots";
import { simulateStandbyAccessEconomics } from "./standby";
import { getActiveProducts } from "./product-catalog";
import {
  deriveAccessProductMix,
  syncPrivateAssumptionsFromProduct,
  getPrivateProduct,
} from "./service-demand-mix";
import {
  calculateServiceBookingEconomics,
  allocateOccupiedBookingsByServiceDemand,
} from "./service-booking-economics";
import { allocateSessionsByAccessMix } from "./session-allocation";
import { calculateCommercialPackSales, type CommercialPackSalesResult } from "./commercial-pack-sales";

import {
  stripGst,
  getEffectiveGstModeForAssumptions,
  productNetPrice,
  productGrossPrice,
  productNetRevenuePerCredit,
  productGrossRevenuePerCredit,
  getEffectiveGstMode,
} from "./product-pricing";

export {
  getEffectiveGstMode,
  getEffectiveGstModeForAssumptions,
  stripGst,
  productNetPrice,
  productGrossPrice,
  productNetRevenuePerCredit,
  productGrossRevenuePerCredit,
} from "./product-pricing";

export interface WeightedRevenueResult {
  /** Group/flexible only — per occupied flexible booking (Drop-In + credit packs) */
  weightedGroupNetSalesPerOccupiedSpot: Decimal;
  /** Group/flexible only — contribution per occupied flexible booking */
  weightedGroupContributionPerOccupiedSpot: Decimal;
  /** All base-case services including Private — per occupied reformer booking */
  blendedNetSalesPerOccupiedSpot: Decimal;
  blendedContributionPerOccupiedSpot: Decimal;
  /** @deprecated alias — use weightedGroupNetSalesPerOccupiedSpot */
  weightedNetRevenuePerCredit: Decimal;
  weightedNetRevenuePerClass: Decimal;
  serviceBookingBreakdown: ReturnType<typeof calculateServiceBookingEconomics>["rows"];
  mixValid: boolean;
  mixTotal: Decimal;
  /** @deprecated legacy customer-mix fields */
  customerMixValid: boolean;
  customerMixTotal: Decimal;
  creditMixTotal: Decimal;
  totalExpectedRedeemedCredits: Decimal;
  breakdown: Array<{
    product: Product;
    flexibleCustomerMixPct: Decimal;
    flexibleCreditMixPct: Decimal;
    expectedRedeemedCredits: Decimal;
    netPerCredit: Decimal;
    grossPerCredit: Decimal;
    netPackagePrice: Decimal;
    grossPackagePrice: Decimal;
    credits: number;
    weightedContribution: Decimal;
    mixPct: Decimal;
    weight: Decimal;
    serviceBookingMixPct: Decimal;
    netSalesPerOccupiedBooking: Decimal;
    contributionPerOccupiedBooking: Decimal;
  }>;
  trace: CalculationTrace;
}

function rowToBreakdown(
  row: ReturnType<typeof calculateServiceBookingEconomics>["rows"][number]
) {
  const credits = Math.max(1, row.product.creditsIncluded || 1);
  const netPackage = row.netSalesPerOccupiedBooking.times(credits);
  return {
    product: row.product,
    serviceBookingMixPct: row.serviceBookingMixPct,
    netSalesPerOccupiedBooking: row.netSalesPerOccupiedBooking,
    contributionPerOccupiedBooking: row.contributionPerOccupiedBooking,
    flexibleCustomerMixPct: row.serviceBookingMixPct,
    flexibleCreditMixPct: row.serviceBookingMixPct,
    expectedRedeemedCredits: row.serviceBookingMixPct,
    netPerCredit: row.netSalesPerOccupiedBooking,
    grossPerCredit: row.netSalesPerOccupiedBooking,
    netPackagePrice: netPackage,
    grossPackagePrice: netPackage,
    credits,
    weightedContribution: row.weightedNetSalesImpact,
    mixPct: row.serviceBookingMixPct.dividedBy(100),
    weight: row.weightedNetSalesImpact,
  };
}

export function calculateWeightedRealisedRevenue(
  assumptions: FinanceAssumptions
): WeightedRevenueResult {
  const economics = calculateServiceBookingEconomics(assumptions);
  const breakdown = economics.rows.map(rowToBreakdown);

  return {
    weightedGroupNetSalesPerOccupiedSpot: economics.weightedGroupNetSalesPerOccupiedSpot,
    weightedGroupContributionPerOccupiedSpot:
      economics.weightedGroupContributionPerOccupiedSpot,
    blendedNetSalesPerOccupiedSpot: economics.blendedNetSalesPerOccupiedSpot,
    blendedContributionPerOccupiedSpot: economics.blendedContributionPerOccupiedSpot,
    weightedNetRevenuePerCredit: economics.weightedGroupNetSalesPerOccupiedSpot,
    weightedNetRevenuePerClass: economics.blendedNetSalesPerOccupiedSpot,
    serviceBookingBreakdown: economics.rows,
    mixValid: economics.mixValid,
    mixTotal: economics.mixTotal,
    customerMixValid: economics.mixValid,
    customerMixTotal: economics.mixTotal,
    creditMixTotal: economics.mixTotal,
    totalExpectedRedeemedCredits: economics.mixTotal,
    breakdown,
    trace: economics.trace,
  };
}

export interface ProductLevelRevenue {
  productId: string;
  productName: string;
  productType: Product["type"];
  sessions: Decimal;
  netRevenue: Decimal;
  cashCollected: Decimal;
}

export interface RevenueResult {
  groupClassRevenue: Decimal;
  /** Net sales from new pack purchases (expectedSalesVolumePerMonth × price) */
  commercialPackRevenue: Decimal;
  /** Drop-in only — pack redemptions are not net sales in purchase-timing model */
  flexibleDeliveryRevenue: Decimal;
  packSalesMultiplier: Decimal;
  commercialPackSales: CommercialPackSalesResult;
  standingSpotRevenue: Decimal;
  privateRevenue: Decimal;
  duoRevenue: Decimal;
  workshopRevenue: Decimal;
  otherRevenue: Decimal;
  standbyRevenue: Decimal;
  dropInRevenue: Decimal;
  grossBookings: Decimal;
  discounts: Decimal;
  refunds: Decimal;
  grossCustomerBillings: Decimal;
  gstCollected: Decimal;
  netRevenue: Decimal;
  weightedRevenue: WeightedRevenueResult;
  sessionAllocation: ReturnType<typeof allocateSessionsByAccessMix>;
  productLevel: ProductLevelRevenue[];
  traces: Record<string, CalculationTrace>;
}

const ZERO = new Decimal(0);

/** No commercial activity — studio not yet open for classes. */
export function createPreOpeningRevenueResult(
  assumptions: FinanceAssumptions
): RevenueResult {
  const weighted = calculateWeightedRealisedRevenue(assumptions);
  const emptyCommercial = calculateCommercialPackSales(assumptions, 0);
  return {
    groupClassRevenue: ZERO,
    commercialPackRevenue: ZERO,
    flexibleDeliveryRevenue: ZERO,
    packSalesMultiplier: emptyCommercial.multiplier,
    commercialPackSales: emptyCommercial,
    standingSpotRevenue: ZERO,
    privateRevenue: ZERO,
    duoRevenue: ZERO,
    workshopRevenue: ZERO,
    otherRevenue: ZERO,
    standbyRevenue: ZERO,
    dropInRevenue: ZERO,
    grossBookings: ZERO,
    discounts: ZERO,
    refunds: ZERO,
    grossCustomerBillings: ZERO,
    gstCollected: ZERO,
    netRevenue: ZERO,
    weightedRevenue: weighted,
    sessionAllocation: allocateSessionsByAccessMix(assumptions, ZERO),
    productLevel: [],
    traces: {},
  };
}

export interface CalculateRevenueOptions {
  /** Booked occupancy % of capacity for ramp pack sales multiplier (defaults to target) */
  bookedOccupancyPct?: number;
}

export function calculateRevenue(
  assumptions: FinanceAssumptions,
  occupiedSeatsMonthly: Decimal,
  options?: CalculateRevenueOptions
): RevenueResult {
  const safe = syncPrivateAssumptionsFromProduct(assumptions);
  const bookedOccupancyPct =
    options?.bookedOccupancyPct ?? safe.projectedBookedOccupancyPct;
  const commercialPackSales = calculateCommercialPackSales(safe, bookedOccupancyPct);
  const weighted = calculateWeightedRealisedRevenue(safe);
  const economics = calculateServiceBookingEconomics(safe);
  const economicsById = new Map(economics.rows.map((r) => [r.product.id, r]));
  const bookingAllocations = allocateOccupiedBookingsByServiceDemand(
    safe,
    occupiedSeatsMonthly
  );
  const allocation = allocateSessionsByAccessMix(safe, occupiedSeatsMonthly);

  const productLevel: ProductLevelRevenue[] = bookingAllocations.map((alloc) => {
    const row = economicsById.get(alloc.product.id)!;
    const netRevenue = alloc.occupiedBookings.times(row.netSalesPerOccupiedBooking);
    return {
      productId: alloc.product.id,
      productName: alloc.product.name,
      productType: alloc.product.type,
      sessions: alloc.occupiedBookings,
      netRevenue,
      cashCollected: netRevenue,
    };
  });

  const standingProducts = safe.standingSpotEnabled
    ? getActiveProducts(safe).filter((p) => p.type === "standing_spot")
    : [];

  const dropInRevenue = sum(
    productLevel.filter((p) => p.productType === "drop_in").map((p) => p.netRevenue)
  );

  const groupClassRevenue = sum([
    dropInRevenue,
    commercialPackSales.totalNetRevenue,
  ]);
  const flexibleDeliveryRevenue = dropInRevenue;
  const commercialPackRevenue = commercialPackSales.totalNetRevenue;
  const privateRevenue = sum(
    productLevel.filter((p) => p.productType === "private").map((p) => p.netRevenue)
  );

  const standingSpotRevenue = safe.standingSpotEnabled
    ? calculateCommittedStandingSpotMonthlyRevenue(safe)
    : new Decimal(0);
  for (const product of standingProducts) {
    productLevel.push({
      productId: product.id,
      productName: product.name,
      productType: "standing_spot",
      sessions: allocation.standingSessions,
      netRevenue: productNetPrice(product, safe),
      cashCollected: productNetPrice(product, safe),
    });
  }

  const standbyProduct = safe.standbyEnabled
    ? getActiveProducts(safe).find((p) => p.type === "standby")
    : undefined;
  let standbyRevenue = new Decimal(0);
  if (standbyProduct && allocation.standbySessions.gt(0)) {
    const sim = simulateStandbyAccessEconomics(assumptions, standbyProduct);
    const perSession = allocation.standbySessions.gt(0)
      ? sim.netIncrementalContribution.dividedBy(
          d(standbyProduct.standbyExpectedAvailableEmptySeats ?? 1)
        )
      : new Decimal(0);
    standbyRevenue = perSession.times(allocation.standbySessions);
    productLevel.push({
      productId: standbyProduct.id,
      productName: standbyProduct.name,
      productType: "standby",
      sessions: allocation.standbySessions,
      netRevenue: standbyRevenue,
      cashCollected: standbyRevenue,
    });
  }

  const duoNet = stripGst(
    d(safe.duoPricePerPerson),
    safe.gstRatePct,
    getEffectiveGstModeForAssumptions(safe)
  ).net;
  const duoRevenue = duoNet
    .times(safe.duoAvgPeople)
    .times(d(safe.duoSessionsPerMonth));

  const workshopNet = stripGst(
    d(safe.workshopPrice),
    safe.gstRatePct,
    getEffectiveGstModeForAssumptions(safe)
  ).net;
  const workshopRevenue = workshopNet.times(safe.workshopCountPerMonth);

  const otherNet = stripGst(
    d(safe.otherRevenuePerMonth),
    safe.gstRatePct,
    getEffectiveGstModeForAssumptions(safe)
  ).net;

  const netRevenue = sum([
    groupClassRevenue,
    standingSpotRevenue,
    standbyRevenue,
    privateRevenue,
    duoRevenue,
    workshopRevenue,
    otherNet,
  ]);

  const gstRate = d(assumptions.gstRatePct).dividedBy(100);
  const gstCollected = assumptions.gstRegistered
    ? netRevenue.times(gstRate)
    : new Decimal(0);
  const grossCustomerBillings = netRevenue.plus(gstCollected);

  return {
    groupClassRevenue,
    commercialPackRevenue,
    flexibleDeliveryRevenue,
    packSalesMultiplier: commercialPackSales.multiplier,
    commercialPackSales,
    standingSpotRevenue,
    privateRevenue,
    duoRevenue,
    workshopRevenue,
    otherRevenue: otherNet,
    standbyRevenue,
    dropInRevenue,
    grossBookings: grossCustomerBillings,
    discounts: new Decimal(0),
    refunds: new Decimal(0),
    grossCustomerBillings,
    gstCollected,
    netRevenue,
    weightedRevenue: weighted,
    sessionAllocation: allocation,
    productLevel,
    traces: {
      commercialPacks: commercialPackSales.trace,
      groupClass: trace(
        "Group class net sales",
        "Drop-in delivery (mix × occupied) + commercial pack purchases (not redemption)",
        "INR/month",
        [
          {
            label: "Drop-in (occupied mix)",
            expression: "drop-in mix × occupied bookings",
            result: dropInRevenue,
          },
          {
            label: "Commercial pack sales",
            expression: `Σ packs sold × net price (×${commercialPackSales.multiplier.toFixed(2)} ramp)`,
            result: commercialPackRevenue,
          },
        ],
        groupClassRevenue
      ),
      private: trace(
        "Private net sales",
        "Private service booking mix × occupied bookings × net sales/session",
        "INR/month",
        productLevel
          .filter((p) => p.productType === "private")
          .map((p) => ({
            label: p.productName,
            expression: `${p.sessions.toFixed(1)} sessions × net price`,
            result: p.netRevenue,
          })),
        privateRevenue
      ),
      sessionAllocation: allocation.trace,
      weightedRevenue: weighted.trace,
    },
  };
}

export {
  analyzeStandingSpotReservations,
  analyzeStandingSpots,
  STANDING_SPOT_EXPLAINER,
  type StandingSpotAnalysis,
} from "./standing-spots";

export interface StandbySimulation {
  emptySeatContribution: Decimal;
  standbyContribution: Decimal;
  incrementalAfterCannibalisation: Decimal;
  estimatedDisplacedRegularContribution: Decimal;
  /** @deprecated Use estimatedDisplacedRegularContribution */
  estimatedCannibalisedContribution: Decimal;
  cannibalisationPct: Decimal;
  breakEvenCannibalisationPct: Decimal;
  warning: string;
}

export function simulateStandbyEconomics(
  assumptions: FinanceAssumptions,
  standbyProduct: Product,
  _occupiedSeatsForClass?: Decimal
): StandbySimulation {
  const sim = simulateStandbyAccessEconomics(assumptions, standbyProduct);
  return {
    emptySeatContribution: new Decimal(0),
    standbyContribution: sim.standbyContribution,
    incrementalAfterCannibalisation: sim.netIncrementalContribution,
    estimatedDisplacedRegularContribution: sim.estimatedDisplacedRegularContribution,
    estimatedCannibalisedContribution: sim.estimatedDisplacedRegularContribution,
    cannibalisationPct: sim.cannibalisationPct,
    breakEvenCannibalisationPct: sim.breakEvenCannibalisationPct,
    warning: sim.warning,
  };
}
