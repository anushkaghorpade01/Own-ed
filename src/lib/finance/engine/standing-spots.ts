import { d, WEEKS_PER_MONTH, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, Product } from "../schemas";
import Decimal from "decimal.js";
import {
  calculateWeightedRealisedRevenue,
  productGrossPrice,
  productNetPrice,
} from "./revenue";
import { countRecurringSlotSessions } from "./calendar-sessions";

/** Core product explainer — reservation vs prepaid package */
export const STANDING_SPOT_EXPLAINER =
  "Standing Spot is primarily a reservation product, not simply a prepaid package. The member pays for a recurring reformer at a specific time. This gives the member certainty and gives OWN committed occupancy for that class, but it also reduces the number of spots available to flexible members.";

export function isStandingSpotRecurring(product: Product): boolean {
  return product.standingSpotRecurringSubscription ?? product.recurring ?? false;
}

export function standingSpotMinCommitmentMonths(product: Product): number {
  return product.standingSpotMinCommitmentMonths ?? 0;
}

export function hasStandingSpotFutureCommitment(product: Product): boolean {
  return isStandingSpotRecurring(product) || standingSpotMinCommitmentMonths(product) > 1;
}

/** Classes per month — calendar from recurringSlots when present, else weekly × WEEKS_PER_MONTH */
export function standingSpotClassesPerMonth(
  product: Product,
  assumptions?: FinanceAssumptions
): Decimal {
  if (
    product.standingSpotClassesPerMonth != null &&
    product.standingSpotClassesPerMonth > 0
  ) {
    return d(product.standingSpotClassesPerMonth);
  }

  const slots = product.standingSpotRules?.recurringSlots ?? [];
  if (slots.length > 0) {
    const calendar = countRecurringSlotSessions(slots, {
      holidays: assumptions?.plannedHolidays,
    });
    return d(calendar.totalSessions);
  }

  return d(product.standingSpotClassesPerWeek ?? 0).times(WEEKS_PER_MONTH);
}

export function standingSpotCommittedSeatsPerClass(product: Product): Decimal {
  return d(product.standingSpotSeatsPerClass ?? 0);
}

export function standingSpotCommittedSeatsPerMonth(
  product: Product,
  assumptions?: FinanceAssumptions
): Decimal {
  return standingSpotClassesPerMonth(product, assumptions).times(
    standingSpotCommittedSeatsPerClass(product)
  );
}

export function totalStandingSpotCommittedSeatsMonthly(
  assumptions: FinanceAssumptions
): Decimal {
  return assumptions.products
    .filter((p) => p.type === "standing_spot")
    .reduce(
      (acc, product) => acc.plus(standingSpotCommittedSeatsPerMonth(product, assumptions)),
      new Decimal(0)
    );
}

/** Earned / planned net revenue from active reservations this month */
export function calculateCommittedStandingSpotMonthlyRevenue(
  assumptions: FinanceAssumptions
): Decimal {
  return assumptions.products
    .filter((p) => p.type === "standing_spot")
    .reduce(
      (acc, product) => acc.plus(productNetPrice(product, assumptions)),
      new Decimal(0)
    );
}

export interface StandingSpotAnalysis {
  product: Product;
  reservedDay: string | null;
  reservedTime: string | null;
  classesPerMonth: Decimal;
  isRecurringSubscription: boolean;
  minCommitmentMonths: number;
  committedSeatsPerClass: Decimal;
  remainingFlexibleSeatsPerClass: Decimal;
  totalCommittedSeatsPerMonth: Decimal;
  flexibleInventorySacrificed: Decimal;
  committedOccupancyBeforeFlexiblePct: Decimal;
  remainingFlexibleInventoryStudioWide: Decimal;
  committedMonthlyRevenue: Decimal;
  monthlyContractedCash: Decimal;
  futureContractedRevenue: Decimal | null;
  hasFutureRevenueVisibility: boolean;
  effectiveNetRevenuePerReservedClass: Decimal;
  comparableCreditPackNetPerClass: Decimal;
  premiumDiscountVsCreditPack: Decimal;
  premiumDiscountPct: Decimal;
  cancellationPolicy: string | null;
  pausePolicy: string | null;
  missedClassPolicy: string | null;
  makeUpEligible: boolean;
  capacityWarning: string | null;
  revenuePredictabilityNote: string;
  traces: Record<string, CalculationTrace>;
}

function buildRevenuePredictabilityNote(product: Product): string {
  const recurring = isStandingSpotRecurring(product);
  const minMonths = standingSpotMinCommitmentMonths(product);

  if (recurring && minMonths > 1) {
    return `Recurring subscription with a ${minMonths}-month minimum commitment — future contracted revenue can be modelled for the commitment window. This differs from one-time prepaid credit packs, where cash is collected upfront but there is no reserved class slot.`;
  }
  if (recurring) {
    return "Recurring subscription — ongoing monthly billing provides revenue visibility, but without a minimum commitment term there is no fixed future contract total. Cash timing is similar to any recurring charge, not inherently more certain than a prepaid pack sold upfront.";
  }
  if (minMonths > 1) {
    return `Fixed ${minMonths}-month commitment — future contracted revenue applies for the remaining commitment period. Upfront or instalment billing should be distinguished from ordinary credit-pack cash collection in cash-flow planning.`;
  }
  return "One-time or month-to-month reservation without a recurring subscription or minimum commitment — does not inherently provide greater future revenue predictability than a comparable prepaid credit pack. Both may collect cash upfront; the Standing Spot difference is reserved capacity and member certainty, not cash guarantee.";
}

function calculateFutureContractedRevenue(
  product: Product,
  committedMonthlyRevenue: Decimal
): Decimal | null {
  const minMonths = standingSpotMinCommitmentMonths(product);
  const recurring = isStandingSpotRecurring(product);

  if (minMonths > 1) {
    return committedMonthlyRevenue.times(minMonths - 1);
  }
  if (recurring) {
    return null;
  }
  return null;
}

function calculateMonthlyContractedCash(
  product: Product,
  assumptions: FinanceAssumptions
): Decimal {
  const grossMonthly = productGrossPrice(product, assumptions);
  const recurring = isStandingSpotRecurring(product);
  const minMonths = standingSpotMinCommitmentMonths(product);

  if (recurring) {
    return grossMonthly;
  }
  if (minMonths <= 1) {
    return grossMonthly;
  }
  // Prepaid multi-month commitment — steady-state months after upfront collection
  return new Decimal(0);
}

export function analyzeStandingSpotReservations(
  assumptions: FinanceAssumptions,
  monthlyAvailableSeats: Decimal
): StandingSpotAnalysis[] {
  const weighted = calculateWeightedRealisedRevenue(assumptions);
  const comparableCreditPackNetPerClass = weighted.weightedNetRevenuePerClass;

  const allCommitted = totalStandingSpotCommittedSeatsMonthly(assumptions);

  return assumptions.products
    .filter((p) => p.type === "standing_spot")
    .map((product) => {
      const classesPerMonth = standingSpotClassesPerMonth(product, assumptions);
      const committedSeatsPerClass = standingSpotCommittedSeatsPerClass(product);
      const classCapacity = d(assumptions.maxGroupClassSize);
      const remainingFlexibleSeatsPerClass = Decimal.max(
        0,
        classCapacity.minus(committedSeatsPerClass)
      );
      const totalCommittedSeatsPerMonth =
        standingSpotCommittedSeatsPerMonth(product);
      const flexibleInventorySacrificed = totalCommittedSeatsPerMonth;
      const committedOccupancyBeforeFlexiblePct = classCapacity.isZero()
        ? new Decimal(0)
        : committedSeatsPerClass.dividedBy(classCapacity).times(100);
      const remainingFlexibleInventoryStudioWide = monthlyAvailableSeats.minus(
        allCommitted
      );

      const committedMonthlyRevenue = productNetPrice(product, assumptions);
      const effectiveNetRevenuePerReservedClass = classesPerMonth.isZero()
        ? new Decimal(0)
        : committedMonthlyRevenue.dividedBy(classesPerMonth);
      const premiumDiscountVsCreditPack = effectiveNetRevenuePerReservedClass.minus(
        comparableCreditPackNetPerClass
      );
      const premiumDiscountPct = comparableCreditPackNetPerClass.isZero()
        ? new Decimal(0)
        : premiumDiscountVsCreditPack
            .dividedBy(comparableCreditPackNetPerClass)
            .times(100);

      const isRecurringSubscription = isStandingSpotRecurring(product);
      const minCommitmentMonths = standingSpotMinCommitmentMonths(product);
      const hasFutureRevenueVisibility =
        hasStandingSpotFutureCommitment(product);
      const futureContractedRevenue = hasFutureRevenueVisibility
        ? calculateFutureContractedRevenue(product, committedMonthlyRevenue)
        : null;
      const monthlyContractedCash = calculateMonthlyContractedCash(
        product,
        assumptions
      );

      const maxSeats = d(product.standingSpotMaxSeatsPerClass ?? 1);
      let capacityWarning: string | null = null;
      if (committedSeatsPerClass.gt(maxSeats)) {
        capacityWarning = `Reserved reformers (${committedSeatsPerClass}) exceed configured maximum (${maxSeats}) per class.`;
      }
      if (committedSeatsPerClass.gt(classCapacity)) {
        capacityWarning = `Reserved reformers (${committedSeatsPerClass}) exceed class size (${assumptions.maxGroupClassSize}).`;
      }
      if (remainingFlexibleInventoryStudioWide.isNegative()) {
        capacityWarning = capacityWarning
          ? `${capacityWarning} Total Standing Spot reservations exceed studio monthly capacity.`
          : "Total Standing Spot reservations exceed studio monthly capacity.";
      }

      const inventoryTrace = trace(
        "Flexible inventory sacrificed",
        "classes/month × reserved reformers per class",
        "seat-reservations/month",
        [
          {
            label: "Classes per month",
            expression: classesPerMonth.toString(),
            result: classesPerMonth,
          },
          {
            label: "Reserved reformers per class",
            expression: committedSeatsPerClass.toString(),
            result: committedSeatsPerClass,
          },
          {
            label: "Inventory removed from flexible pool",
            expression: `${classesPerMonth.toString()} × ${committedSeatsPerClass.toString()}`,
            result: flexibleInventorySacrificed,
          },
        ],
        flexibleInventorySacrificed
      );

      const revenueTrace = trace(
        "Committed monthly revenue",
        "Net monthly reservation price (earned/planned for delivered reserved classes)",
        "INR/month",
        [
          {
            label: "Net monthly price",
            expression: committedMonthlyRevenue.toString(),
            result: committedMonthlyRevenue,
          },
        ],
        committedMonthlyRevenue
      );

      return {
        product,
        reservedDay: product.standingSpotReservedDay ?? null,
        reservedTime: product.standingSpotReservedTime ?? null,
        classesPerMonth,
        isRecurringSubscription,
        minCommitmentMonths,
        committedSeatsPerClass,
        remainingFlexibleSeatsPerClass,
        totalCommittedSeatsPerMonth,
        flexibleInventorySacrificed,
        committedOccupancyBeforeFlexiblePct,
        remainingFlexibleInventoryStudioWide,
        committedMonthlyRevenue,
        monthlyContractedCash,
        futureContractedRevenue,
        hasFutureRevenueVisibility,
        effectiveNetRevenuePerReservedClass,
        comparableCreditPackNetPerClass,
        premiumDiscountVsCreditPack,
        premiumDiscountPct,
        cancellationPolicy: product.standingSpotCancellationPolicy ?? null,
        pausePolicy: product.standingSpotPausePolicy ?? null,
        missedClassPolicy: product.standingSpotMissedClassPolicy ?? null,
        makeUpEligible: product.standingSpotMakeUpEligible ?? false,
        capacityWarning,
        revenuePredictabilityNote: buildRevenuePredictabilityNote(product),
        traces: {
          inventory: inventoryTrace,
          revenue: revenueTrace,
        },
      };
    });
}

/** @deprecated Use analyzeStandingSpotReservations */
export function analyzeStandingSpots(
  assumptions: FinanceAssumptions,
  monthlyAvailableSeats: Decimal
): Array<
  StandingSpotAnalysis & {
    /** @deprecated Use committedMonthlyRevenue */
    guaranteedMonthlyRevenue: Decimal;
    /** @deprecated Use flexibleInventorySacrificed */
    capacityLockedPerMonth: Decimal;
    /** @deprecated Use effectiveNetRevenuePerReservedClass */
    effectiveNetRevenuePerClass: Decimal;
    /** @deprecated Use remainingFlexibleInventoryStudioWide */
    remainingFlexibleInventory: Decimal;
  }
> {
  return analyzeStandingSpotReservations(
    assumptions,
    monthlyAvailableSeats
  ).map((analysis) => ({
    ...analysis,
    guaranteedMonthlyRevenue: analysis.committedMonthlyRevenue,
    capacityLockedPerMonth: analysis.flexibleInventorySacrificed,
    effectiveNetRevenuePerClass: analysis.effectiveNetRevenuePerReservedClass,
    remainingFlexibleInventory: analysis.remainingFlexibleInventoryStudioWide,
  }));
}
