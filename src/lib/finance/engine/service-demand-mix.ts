/**
 * Founder-facing service demand mix → engine translation.
 *
 * Base Case planning mix: active drop_in, credit_pack, private products sum to 100%.
 * Standing and Standby are optional toggles — not in this mix.
 */
import { d, sum } from "../decimal";
import type { FinanceAssumptions, Product, AccessProductMix } from "../schemas";
import Decimal from "decimal.js";
import { getActiveProducts, ensureProductVersionFields } from "./product-catalog";

export const BASE_CASE_MIX_TYPES = ["drop_in", "credit_pack", "private"] as const;

export type BaseCaseMixProduct = Product & { type: (typeof BASE_CASE_MIX_TYPES)[number] };

export function getServiceDemandPct(product: Product): number {
  return product.serviceDemandPct ?? product.packageMixPct ?? 0;
}

export function listBaseCaseMixProducts(
  assumptions: FinanceAssumptions
): BaseCaseMixProduct[] {
  return assumptions.products
    .filter(
      (p): p is BaseCaseMixProduct =>
        (BASE_CASE_MIX_TYPES as readonly string[]).includes(p.type) &&
        p.lifecycle !== "archived"
    )
    .sort((a, b) => {
      const order = (t: string) =>
        t === "drop_in" ? 0 : t === "credit_pack" ? 1 : 2;
      return order(a.type) - order(b.type) || a.name.localeCompare(b.name);
    });
}

export const PROTECTED_MIX_PRODUCT_IDS = new Set([
  "drop-in",
  "8-pack",
  "16-pack",
  "private-session",
]);

export function canRemoveFromServiceDemandMix(
  product: Product,
  assumptions: FinanceAssumptions
): boolean {
  const inMix = listBaseCaseMixProducts(assumptions);
  if (PROTECTED_MIX_PRODUCT_IDS.has(product.id)) return false;
  if (product.type === "credit_pack") return true;
  if (product.type === "drop_in") {
    return inMix.filter((p) => p.type === "drop_in").length > 1;
  }
  if (product.type === "private") {
    return inMix.filter((p) => p.type === "private").length > 1;
  }
  return false;
}

/** After removing a mix product, scale remaining base-case shares to 100%. */
export function normalizeServiceDemandMixTo100(products: Product[]): Product[] {
  const base = listBaseCaseMixProducts({
    ...({} as FinanceAssumptions),
    products,
  });
  if (base.length === 0) return products;

  const total = base.reduce((s, p) => s + getServiceDemandPct(p), 0);
  const baseIds = new Set(base.map((p) => p.id));

  if (total <= 0) {
    const each = Math.round((100 / base.length) * 10) / 10;
    return products.map((p) => {
      if (!baseIds.has(p.id)) return p;
      return {
        ...p,
        serviceDemandPct: each,
        packageMixPct: p.type === "private" ? 0 : each,
      };
    });
  }

  const scaled = products.map((p) => {
    if (!baseIds.has(p.id)) return p;
    const pct = Math.round((getServiceDemandPct(p) / total) * 1000) / 10;
    return {
      ...p,
      serviceDemandPct: pct,
      packageMixPct: p.type === "private" ? 0 : pct,
    };
  });

  const mixTotal = base.reduce((s, p) => {
    const updated = scaled.find((x) => x.id === p.id);
    return s + getServiceDemandPct(updated ?? p);
  }, 0);
  const remainder = Math.round((100 - mixTotal) * 10) / 10;
  if (remainder !== 0) {
    const adjustId = base.reduce((a, b) =>
      getServiceDemandPct(scaled.find((x) => x.id === a.id) ?? a) >=
      getServiceDemandPct(scaled.find((x) => x.id === b.id) ?? b)
        ? a
        : b
    ).id;
    return scaled.map((p) => {
      if (p.id !== adjustId) return p;
      const next = Math.round((getServiceDemandPct(p) + remainder) * 10) / 10;
      return {
        ...p,
        serviceDemandPct: next,
        packageMixPct: p.type === "private" ? 0 : next,
      };
    });
  }

  return scaled;
}

export function removeProductFromServiceDemandMix(
  products: Product[],
  productId: string
): Product[] {
  return normalizeServiceDemandMixTo100(products.filter((p) => p.id !== productId));
}

export function createServiceMixCreditPack(
  existingPackCount: number
): Product {
  return ensureProductVersionFields({
    id: `flex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: existingPackCount > 0 ? `Credit Pack ${existingPackCount + 1}` : "New Credit Pack",
    type: "credit_pack",
    price: 10000,
    gstTreatment: "exclusive",
    gstFollowsGlobal: true,
    creditsIncluded: 10,
    packageMixPct: 0,
    serviceDemandPct: 0,
    peakEligible: true,
    recurring: false,
    discountPct: 0,
    classEligibility: [],
    standingSpotMaxSeatsPerClass: 1,
    lifecycle: "active",
    packRules: {
      validityValue: 8,
      validityUnit: "weeks",
      validityBeginsFrom: "activation",
      activationDeadlineDays: 30,
      activationPolicy: "expire_if_not_activated",
      eligibleClassTypes: [],
      eligibleTimeBands: ["peak", "standard", "off_peak"],
      expectedRedemptionRatePct: 85,
      expectedBreakageRatePct: 15,
      expectedCancellationRatePct: 5,
      expectedNoShowRatePct: 3,
      expectedPeakBookingSharePct: 50,
      transferable: false,
      refundable: false,
      expectedSalesVolumePerMonth: 0,
      active: true,
      displayOrder: 50 + existingPackCount,
    },
  });
}
export function ensureBaseCaseMixProducts(
  assumptions: FinanceAssumptions
): FinanceAssumptions {
  const samplePrivate = {
    id: "private-session",
    name: "Private Session",
    type: "private" as const,
    price: assumptions.privatePrice || 4000,
    gstTreatment: "exclusive" as const,
    gstFollowsGlobal: true,
    creditsIncluded: 0,
    packageMixPct: 0,
    serviceDemandPct: 15,
    peakEligible: true,
    recurring: false,
    discountPct: 0,
    classEligibility: [] as string[],
    standingSpotMaxSeatsPerClass: 1,
    privateRules: {
      durationMinutes: assumptions.privateDurationMinutes ?? 55,
      clientsPerSession: 1,
      reformersOccupied: assumptions.privateReformersOccupied ?? 1,
      instructorCostPerHour:
        assumptions.privateInstructorCost > 0
          ? assumptions.privateInstructorCost / ((assumptions.privateDurationMinutes ?? 55) / 60)
          : 800,
      otherDirectVariableCost: 30,
      eligibleTimeBands: ["standard", "off_peak"] as ("peak" | "standard" | "off_peak")[],
      expectedSessionsPerMonth: 0,
      expectedCancellationRatePct: 5,
      expectedNoShowRatePct: 3,
    },
  };

  const hasPrivate = assumptions.products.some(
    (p) => p.type === "private" && p.lifecycle !== "archived"
  );

  if (hasPrivate) return assumptions;

  return {
    ...assumptions,
    products: [...assumptions.products, ensureProductVersionFields(samplePrivate)],
  };
}

export function calculateServiceDemandMixTotal(
  assumptions: FinanceAssumptions
): { total: Decimal; valid: boolean; products: BaseCaseMixProduct[] } {
  const products = listBaseCaseMixProducts(assumptions);
  const total = sum(products.map((p) => d(getServiceDemandPct(p))));
  return { total, valid: total.equals(100), products };
}

/** Auto-balance remaining mix proportionally among open products */
export function autoBalanceServiceDemandMix(
  products: Product[],
  changedProductId: string,
  newPct: number
): Product[] {
  const baseIds = new Set(
    listBaseCaseMixProducts({ ...({} as FinanceAssumptions), products }).map((p) => p.id)
  );
  const clamped = Math.max(0, Math.min(100, newPct));
  const others = products.filter(
    (p) => baseIds.has(p.id) && p.id !== changedProductId
  );
  const remaining = 100 - clamped;
  const otherTotal = others.reduce((s, p) => s + getServiceDemandPct(p), 0);

  return products.map((p) => {
    if (!baseIds.has(p.id)) return p;
    if (p.id === changedProductId) {
      const patch = { serviceDemandPct: clamped, packageMixPct: p.type === "private" ? 0 : clamped };
      return { ...p, ...patch };
    }
    if (others.length === 0) return p;
    const share =
      otherTotal > 0
        ? (getServiceDemandPct(p) / otherTotal) * remaining
        : remaining / others.length;
    const rounded = Math.round(share * 10) / 10;
    return {
      ...p,
      serviceDemandPct: rounded,
      packageMixPct: p.type === "private" ? 0 : rounded,
    };
  });
}

export function deriveAccessProductMix(
  assumptions: FinanceAssumptions
): AccessProductMix & { mixValid: boolean; mixTotal: Decimal } {
  const products = listBaseCaseMixProducts(assumptions);
  let flexibleShare = 0;
  let privateShare = 0;

  for (const p of products) {
    const pct = getServiceDemandPct(p);
    if (p.type === "private") privateShare += pct;
    else flexibleShare += pct;
  }

  const standingSpotPct = assumptions.standingSpotEnabled
    ? assumptions.accessProductMix?.standingSpotPct ?? 0
    : 0;
  const standbyPct = assumptions.standbyEnabled
    ? assumptions.accessProductMix?.standbyPct ?? 0
    : 0;

  // When using simplified mix, standing/standby are additive optional layers on top of base 100%
  // They consume capacity separately — not part of the 100% service demand split
  const mix: AccessProductMix = {
    flexiblePackPct: flexibleShare,
    standingSpotPct,
    dropInPct: 0,
    standbyPct,
    privateDuoPct: privateShare,
    trialPct: 0,
  };

  const mixTotal = d(flexibleShare).plus(privateShare).plus(standingSpotPct).plus(standbyPct);
  const baseValid = d(flexibleShare).plus(privateShare).equals(100);

  return {
    ...mix,
    mixValid: baseValid && (standingSpotPct + standbyPct === 0 || true),
    mixTotal,
  };
}

/** Split total attended reformer spots into group vs private */
export function splitServiceDemandSpots(
  assumptions: FinanceAssumptions,
  totalAttendedSpots: Decimal
): {
  groupSpots: Decimal;
  privateSpots: Decimal;
  privateSharePct: Decimal;
  groupSharePct: Decimal;
} {
  const products = listBaseCaseMixProducts(assumptions);
  let privateShare = 0;
  let groupShare = 0;
  for (const p of products) {
    const pct = getServiceDemandPct(p);
    if (p.type === "private") privateShare += pct;
    else groupShare += pct;
  }
  const privatePct = d(privateShare).dividedBy(100);
  const groupPct = d(groupShare).dividedBy(100);

  return {
    groupSpots: totalAttendedSpots.times(groupPct),
    privateSpots: totalAttendedSpots.times(privatePct),
    privateSharePct: d(privateShare),
    groupSharePct: d(groupShare),
  };
}

/** Sync flexible SKU packageMixPct from serviceDemandPct for credit mix weighting */
export function syncFlexiblePackageMixFromServiceDemand(
  products: Product[]
): Product[] {
  const flex = products.filter(
    (p) => p.type === "drop_in" || p.type === "credit_pack"
  );
  const flexTotal = flex.reduce((s, p) => s + getServiceDemandPct(p), 0);
  if (flexTotal <= 0) return products;

  return products.map((p) => {
    if (p.type !== "drop_in" && p.type !== "credit_pack") return p;
    const demand = getServiceDemandPct(p);
    const normalized = Math.round((demand / flexTotal) * 1000) / 10;
    return { ...p, packageMixPct: normalized, serviceDemandPct: demand };
  });
}

export function getPrivateProduct(
  assumptions: FinanceAssumptions
): Product | undefined {
  return getActiveProducts(assumptions).find((p) => p.type === "private");
}

/** Sync legacy assumption fields from private Product */
export function syncPrivateAssumptionsFromProduct(
  assumptions: FinanceAssumptions
): FinanceAssumptions {
  const privateProduct = getPrivateProduct(assumptions);
  if (!privateProduct) return assumptions;
  const rules = privateProduct.privateRules;
  return {
    ...assumptions,
    privatePrice: privateProduct.price,
    privateDurationMinutes: rules?.durationMinutes ?? assumptions.privateDurationMinutes,
    privateReformersOccupied: rules?.reformersOccupied ?? assumptions.privateReformersOccupied,
    privateInstructorCost:
      rules?.instructorCostPerHour != null
        ? rules.instructorCostPerHour *
          ((rules.durationMinutes ?? 55) / 60)
        : assumptions.privateInstructorCost,
    privateSessionsPerMonth:
      rules?.expectedSessionsPerMonth ?? assumptions.privateSessionsPerMonth,
  };
}
