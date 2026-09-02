/**
 * Normalise access product mix — Drop-In is a flexible SKU, not a top-level channel.
 */
import type { AccessProductMix, FinanceAssumptions } from "../schemas";

export const CANONICAL_ACCESS_CATEGORIES = [
  "flexiblePackPct",
  "standingSpotPct",
  "standbyPct",
  "privateDuoPct",
  "trialPct",
] as const;

export function migrateAccessProductMix(
  mix: Partial<AccessProductMix> | undefined,
  defaults: AccessProductMix
): AccessProductMix {
  const merged: AccessProductMix = {
    flexiblePackPct: mix?.flexiblePackPct ?? defaults.flexiblePackPct,
    standingSpotPct: mix?.standingSpotPct ?? defaults.standingSpotPct,
    dropInPct: 0,
    standbyPct: mix?.standbyPct ?? defaults.standbyPct,
    privateDuoPct: mix?.privateDuoPct ?? defaults.privateDuoPct,
    trialPct: mix?.trialPct ?? defaults.trialPct ?? 0,
  };

  // Legacy: fold former dropInPct into flexible pool
  const legacyDropIn = mix?.dropInPct ?? 0;
  if (legacyDropIn > 0) {
    merged.flexiblePackPct += legacyDropIn;
  }

  return merged;
}

export function normalizeAssumptionsAccessMix(assumptions: FinanceAssumptions): FinanceAssumptions {
  const defaults: AccessProductMix = {
    flexiblePackPct: 60,
    standingSpotPct: 15,
    dropInPct: 0,
    standbyPct: 5,
    privateDuoPct: 10,
    trialPct: 0,
  };
  return {
    ...assumptions,
    accessProductMix: migrateAccessProductMix(assumptions.accessProductMix, defaults),
  };
}
