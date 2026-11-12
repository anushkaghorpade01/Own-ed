import { FinanceAssumptionsSchema } from "./schemas";
import type { FinanceAssumptions } from "./schemas";
import { migrateLegacyProducts } from "./engine/product-migration";
import { ensureProductVersionFields } from "./engine/product-catalog";
import { migrateAccessProductMix } from "./engine/access-mix-migration";
import { migratePricingSemantics } from "./engine/pricing-migration";
import {
  calculateServiceDemandMixTotal,
  syncFlexiblePackageMixFromServiceDemand,
  ensureBaseCaseMixProducts,
} from "./engine/service-demand-mix";
import { resolveSteadyStateAttendedPct } from "./engine/attended-occupancy";
import { scheduleConflicts } from "./engine/own-operating-plan";

export interface ValidationError {
  field: string;
  message: string;
}

function schemaDefaults(
  partial?: Partial<FinanceAssumptions>
): FinanceAssumptions {
  return FinanceAssumptionsSchema.parse({
    id: partial?.id ?? "assumptions-local",
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
  });
}

/** Drop null/undefined so Zod defaults apply (JSON null does not trigger .default()). */
function omitNullish<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === "object"
          ? omitNullish(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === "object") {
      out[key] = omitNullish(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as Partial<T>;
}

/** Merge partial saved assumptions with schema defaults (handles localStorage migrations). */
export function normalizeAssumptions(
  partial: Partial<FinanceAssumptions> | undefined,
  fallback?: FinanceAssumptions
): FinanceAssumptions {
  const base = fallback ?? schemaDefaults(partial);
  if (!partial) return base;

  const cleaned = omitNullish(partial as Record<string, unknown>) as Partial<FinanceAssumptions>;

  const merged: FinanceAssumptions = {
    ...base,
    ...cleaned,
    accessProductMix: migrateAccessProductMix(
      cleaned.accessProductMix ?? base.accessProductMix,
      base.accessProductMix ?? {
        flexiblePackPct: 70,
        standingSpotPct: 15,
        dropInPct: 0,
        standbyPct: 5,
        privateDuoPct: 10,
        trialPct: 0,
      }
    ),
    products: (() => {
      const raw = migrateLegacyProducts(
        (cleaned.products ?? base.products).map((p) => ({
          ...p,
          gstFollowsGlobal: p.gstFollowsGlobal !== false,
        }))
      ).products;
      return syncFlexiblePackageMixFromServiceDemand(
        raw.map((p) => {
          const withVersion = ensureProductVersionFields(p);
          if (!withVersion.privateRules) return withVersion;
          return {
            ...withVersion,
            privateRules: {
              ...withVersion.privateRules,
              instructorCostPerHour: 0,
            },
          };
        })
      );
    })(),
    standingSpotEnabled: cleaned.standingSpotEnabled ?? base.standingSpotEnabled ?? false,
    standbyEnabled: cleaned.standbyEnabled ?? base.standbyEnabled ?? false,
    privateRequiresExclusiveStudio:
      cleaned.privateRequiresExclusiveStudio ?? base.privateRequiresExclusiveStudio ?? false,
    customExpenses: cleaned.customExpenses ?? base.customExpenses ?? [],
    schedule: cleaned.schedule ?? base.schedule,
    rampUpCurve: cleaned.rampUpCurve ?? base.rampUpCurve,
  };

  // In OWN mode contributor amounts are the source of truth for founder
  // funding. Never treat them as revenue or as a second cash injection.
  if (merged.ownOperatingPlan?.enabled && merged.ownOperatingPlan.contributions.length > 0) {
    const contributions = merged.ownOperatingPlan.contributions.reduce((total, c) => total + c.amount, 0);
    // An untouched empty contributor table must not erase existing funding.
    if (contributions > 0) merged.founderEquity = contributions;
  }
  const parsed = FinanceAssumptionsSchema.safeParse(merged);
  const normalized = parsed.success ? parsed.data : base;
  const withMix = migratePricingSemantics(ensureBaseCaseMixProducts(normalized));
  const syncedAttended =
    withMix.attendedOccupancyMode === "linked"
      ? {
          ...withMix,
          projectedAttendedOccupancyPct: resolveSteadyStateAttendedPct(withMix),
        }
      : withMix;
  return {
    ...syncedAttended,
    instructorPerClassPayout: 0,
    instructorPerAttendeePayout: 0,
  };
}

export function validateAssumptions(
  assumptions: FinanceAssumptions
): ValidationError[] {
  const errors: ValidationError[] = [];

  const parsed = FinanceAssumptionsSchema.safeParse(assumptions);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        field: issue.path.join("."),
        message: issue.message,
      });
    }
  }

  if (assumptions.ownOperatingPlan?.enabled) {
    const plan = assumptions.ownOperatingPlan;
    if (!plan.schedule.some(s => s.active)) errors.push({
      field: "ownOperatingPlan.schedule",
      message: "Add weekly class or private-session slots to forecast available capacity.",
    });
    for (const message of scheduleConflicts(plan)) errors.push({
      field: "ownOperatingPlan.schedule",
      message,
    });
    for (const item of plan.packages.filter(p => p.active)) {
      if (item.price === 0 && item.expectedSalesPerMonth > 0) errors.push({
        field: `ownOperatingPlan.packages.${item.id}.price`,
        message: `${item.family} · ${item.name} has forecast sales but no selling price.`,
      });
      if (Object.values(item.sessions).every(n => n === 0)) errors.push({
        field: `ownOperatingPlan.packages.${item.id}.sessions`,
        message: `${item.family} · ${item.name} has no session allocation.`,
      });
    }
    // The legacy flexible-credit catalogue is inactive in OWN mode; its
    // pricing and mix checks should not invalidate the new operating plan.
    return errors;
  }

  const creditProducts = assumptions.products.filter(
    (p) => p.type === "drop_in" || p.type === "credit_pack"
  );
  const mixTotal = creditProducts.reduce((s, p) => s + p.packageMixPct, 0);
  if (creditProducts.length > 0 && mixTotal !== 100) {
    errors.push({
      field: "products.packageMixPct",
      message: `Flexible SKU mix (within group) must equal 100%. Currently ${mixTotal}%.`,
    });
  }

  const serviceMix = calculateServiceDemandMixTotal(assumptions);
  if (serviceMix.products.length > 0 && !serviceMix.valid) {
    errors.push({
      field: "products.serviceDemandPct",
      message: `Service demand mix must equal 100%. Currently ${serviceMix.total.toString()}%.`,
    });
  }

  if (assumptions.projectedBookedOccupancyPct > 100) {
    errors.push({
      field: "projectedBookedOccupancyPct",
      message: "Occupancy cannot exceed 100% unless overbooking is enabled.",
    });
  }

  for (const product of assumptions.products) {
    if (product.price <= 0) {
      errors.push({
        field: `products.${product.id}.price`,
        message: `${product.name} price is ₹0 or negative.`,
      });
    }
    if (product.type === "standing_spot") {
      const seats = product.standingSpotSeatsPerClass ?? 0;
      if (seats > assumptions.maxGroupClassSize) {
        errors.push({
          field: `products.${product.id}.standingSpotSeatsPerClass`,
          message: `Standing Spots (${seats}) exceed class size (${assumptions.maxGroupClassSize}).`,
        });
      }
      if (seats > assumptions.reformers) {
        errors.push({
          field: `products.${product.id}.standingSpotSeatsPerClass`,
          message: `Standing Spots (${seats}) exceed reformer count (${assumptions.reformers}).`,
        });
      }
    }
  }

  if (
    assumptions.useScheduleForCapacity &&
    assumptions.schedule.length === 0
  ) {
    errors.push({
      field: "schedule",
      message: "No operating schedule exists. Capacity calculations cannot run in schedule mode.",
    });
  }

  return errors;
}
