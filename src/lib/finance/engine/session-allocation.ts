/**
 * Session allocation across access product types.
 *
 * TWO DISTINCT MIX MODELS (do not merge):
 * - accessProductMix: share of total expected REFORMER SESSIONS by access type
 * - packageMixPct: share of flexible CUSTOMERS across flexible SKUs (input)
 * - flexibleCreditMixPct: derived share of expected REDEEMED CREDITS (weighting basis)
 *
 * Session split within the flexible pool uses credit mix, not customer mix.
 *
 * Combined share example:
 *   totalSessions × accessProductMix.flexible × packageMixPct[8-pack]
 */
import { d, sum, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, Product, AccessProductMix } from "../schemas";
import Decimal from "decimal.js";
import { getActiveProducts } from "./product-catalog";
import { listFlexiblePacks } from "./flexible-packs";
import { countRecurringSlotSessions } from "./calendar-sessions";
import { standingSpotCommittedSeatsPerClass } from "./standing-spots";
import { migrateAccessProductMix } from "./access-mix-migration";
import { deriveAccessProductMix, getServiceDemandPct, listBaseCaseMixProducts } from "./service-demand-mix";

export interface AccessMixSessionAllocation {
  totalAttendedSessions: Decimal;
  /** Sessions by access type from accessProductMix */
  flexibleCreditSessions: Decimal;
  standingSessions: Decimal;
  dropInSessions: Decimal;
  standbySessions: Decimal;
  privateDuoSessions: Decimal;
  /** Flexible SKU breakdown: accessMix.flexible × flexibleCreditMixPct */
  flexibleSkuSessions: Array<{
    product: Product;
    packageMixPct: Decimal;
    flexibleCreditMixPct: Decimal;
    sessionsFromTotal: Decimal;
    sessionsFromFlexiblePool: Decimal;
  }>;
  mixValid: boolean;
  accessMixTotal: Decimal;
  packageMixTotal: Decimal;
  trace: CalculationTrace;
}

const DEFAULT_ACCESS_MIX: AccessProductMix = {
  flexiblePackPct: 70,
  standingSpotPct: 15,
  dropInPct: 0,
  standbyPct: 5,
  privateDuoPct: 10,
  trialPct: 0,
};

export function resolveAccessProductMix(
  assumptions: FinanceAssumptions
): AccessProductMix & { mixValid: boolean; mixTotal: Decimal } {
  const derived = deriveAccessProductMix(assumptions);
  const mixTotal = d(derived.flexiblePackPct)
    .plus(derived.standingSpotPct)
    .plus(derived.standbyPct)
    .plus(derived.privateDuoPct)
    .plus(derived.trialPct ?? 0);
  return {
    ...derived,
    dropInPct: 0,
    mixValid: derived.mixValid,
    mixTotal,
  };
}

/** Total expected attended reformer sessions for the month */
export function expectedAttendedReformerSessions(
  assumptions: FinanceAssumptions,
  occupiedSeatsMonthly: Decimal
): Decimal {
  return occupiedSeatsMonthly;
}

export function allocateSessionsByAccessMix(
  assumptions: FinanceAssumptions,
  occupiedSeatsMonthly: Decimal
): AccessMixSessionAllocation {
  const accessMix = resolveAccessProductMix(assumptions);
  const total = expectedAttendedReformerSessions(assumptions, occupiedSeatsMonthly);
  const pct = (n: number) => d(n).dividedBy(100);

  const flexProducts = listBaseCaseMixProducts(assumptions).filter(
    (p) => p.type === "drop_in" || p.type === "credit_pack"
  );
  const privateMixPct = listBaseCaseMixProducts(assumptions)
    .filter((p) => p.type === "private")
    .reduce((s, p) => s + getServiceDemandPct(p), 0);

  const flexibleSkuSessions = flexProducts.map((product) => {
    const mixPct = d(getServiceDemandPct(product)).dividedBy(100);
    const sessionsFromTotal = total.times(mixPct);
    return {
      product,
      packageMixPct: d(getServiceDemandPct(product)),
      flexibleCreditMixPct: d(getServiceDemandPct(product)),
      sessionsFromTotal,
      sessionsFromFlexiblePool: sessionsFromTotal,
    };
  });

  const flexibleCreditSessions = sum(flexibleSkuSessions.map((s) => s.sessionsFromTotal));
  const packageMixTotal = sum(flexProducts.map((p) => d(getServiceDemandPct(p))));
  const standingSessions = total.times(pct(accessMix.standingSpotPct));
  const dropInSessions = new Decimal(0);
  const standbySessions = total.times(pct(accessMix.standbyPct));
  const privateDuoSessions = total.times(d(privateMixPct).dividedBy(100));

  const steps = [
    {
      label: "Total attended sessions",
      expression: occupiedSeatsMonthly.toString(),
      result: total,
    },
    ...flexibleSkuSessions.map((s) => ({
      label: `${s.product.name} (service booking mix)`,
      expression: `${s.flexibleCreditMixPct.toFixed(1)}% × ${total.toFixed(0)} occupied bookings`,
      result: s.sessionsFromTotal,
    })),
    {
      label: "Private sessions (service booking mix)",
      expression: `${privateMixPct}% × ${total.toFixed(0)}`,
      result: privateDuoSessions,
    },
  ];

  return {
    totalAttendedSessions: total,
    flexibleCreditSessions,
    standingSessions,
    dropInSessions,
    standbySessions,
    privateDuoSessions,
    flexibleSkuSessions,
    mixValid: accessMix.mixValid && packageMixTotal.plus(d(privateMixPct)).equals(100),
    accessMixTotal: accessMix.mixTotal,
    packageMixTotal,
    trace: trace(
      "Session allocation by service demand mix",
      "Each base-case service receives occupied bookings proportional to serviceDemandPct",
      "bookings/month",
      steps,
      total
    ),
  };
}

/** Standing reserved sessions from calendar recurringSlots (not weekly × 4.33) */
export function standingReservedSessionsFromCalendar(
  assumptions: FinanceAssumptions,
  referenceDate?: Date
): Decimal {
  const standingProducts = getActiveProducts(assumptions).filter(
    (p) => p.type === "standing_spot"
  );

  let total = new Decimal(0);
  for (const product of standingProducts) {
    const slots = product.standingSpotRules?.recurringSlots ?? [];
    const seats = standingSpotCommittedSeatsPerClass(product);

    if (slots.length > 0) {
      const calendar = countRecurringSlotSessions(slots, {
        referenceDate,
        holidays: assumptions.plannedHolidays,
      });
      total = total.plus(d(calendar.totalSessions).times(seats));
    } else {
      const classesPerWeek = product.standingSpotClassesPerWeek ?? 0;
      const weeksInMonth = 4.33;
      total = total.plus(d(classesPerWeek).times(weeksInMonth).times(seats));
    }
  }
  return total;
}

/** Occupancy waterfall: physical → standing reserved → flexible remainder */
export interface OccupancyWaterfall {
  physicalCapacitySessions: Decimal;
  standingReservedSessions: Decimal;
  remainingFlexibleCapacity: Decimal;
  flexibleRedemptionSessions: Decimal;
  dropInSessions: Decimal;
  standbySessions: Decimal;
  constraintMet: boolean;
}

export function buildOccupancyWaterfall(
  assumptions: FinanceAssumptions,
  physicalCapacitySessions: Decimal,
  occupiedSeatsMonthly: Decimal
): OccupancyWaterfall {
  const allocation = allocateSessionsByAccessMix(assumptions, occupiedSeatsMonthly);
  const standingReserved = standingReservedSessionsFromCalendar(assumptions);
  const remainingFlexible = Decimal.max(
    0,
    physicalCapacitySessions.minus(standingReserved)
  );

  const totalAllocated = allocation.flexibleCreditSessions
    .plus(allocation.dropInSessions)
    .plus(standingReserved)
    .plus(allocation.standbySessions);

  return {
    physicalCapacitySessions,
    standingReservedSessions: standingReserved,
    remainingFlexibleCapacity: remainingFlexible,
    flexibleRedemptionSessions: allocation.flexibleCreditSessions,
    dropInSessions: allocation.dropInSessions,
    standbySessions: allocation.standbySessions,
    constraintMet: totalAllocated.lte(physicalCapacitySessions),
  };
}

/** Explicit combined share: flexible access × SKU package mix */
export function combinedSkuShareOfTotalSessions(
  accessMixFlexiblePct: number,
  packageMixPct: number
): Decimal {
  return d(accessMixFlexiblePct).dividedBy(100).times(d(packageMixPct).dividedBy(100));
}
