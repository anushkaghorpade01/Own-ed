/**
 * Commercial pack sales — purchase-time revenue & cash (distinct from redemption / occupancy mix).
 */
import Decimal from "decimal.js";
import { d, sum, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, Product } from "../schemas";
import { listFlexiblePacks } from "./flexible-packs";
import { productGrossPrice, productNetPrice } from "./product-pricing";

export interface CommercialPackSalesRow {
  productId: string;
  productName: string;
  basePacksSold: Decimal;
  packsSold: Decimal;
  netRevenue: Decimal;
  grossCashCollected: Decimal;
  newCredits: Decimal;
}

export interface CommercialPackSalesResult {
  /** 1 at target occupancy; >1 when aggressive pre-sale below target */
  multiplier: Decimal;
  bookedOccupancyPct: number;
  rows: CommercialPackSalesRow[];
  totalNetRevenue: Decimal;
  totalGrossCashCollected: Decimal;
  totalNewCredits: Decimal;
  trace: CalculationTrace;
}

export function resolveRampPackSalesMultiplier(
  assumptions: FinanceAssumptions,
  bookedOccupancyPct: number
): Decimal {
  if ((assumptions.rampPackSalesMode ?? "aggressive_presale") !== "aggressive_presale") {
    return d(1);
  }

  const target = assumptions.projectedBookedOccupancyPct;
  const current = Math.max(0, bookedOccupancyPct);

  if (target <= 0 || current >= target) {
    return d(1);
  }

  const raw = target / Math.max(current, 0.5);
  const cap = assumptions.rampPackSalesMultiplierCap ?? 3;
  return d(Math.min(cap, Math.max(1, raw)));
}

export function buildCommercialPackSalesVolumes(
  assumptions: FinanceAssumptions,
  bookedOccupancyPct: number
): { multiplier: Decimal; volumesByProductId: Record<string, number> } {
  const multiplier = resolveRampPackSalesMultiplier(assumptions, bookedOccupancyPct);
  const volumesByProductId: Record<string, number> = {};

  for (const product of listFlexiblePacks(assumptions)) {
    const base = Math.max(0, product.packRules?.expectedSalesVolumePerMonth ?? 0);
    volumesByProductId[product.id] =
      Math.round(base * multiplier.toNumber() * 1000) / 1000;
  }

  return { multiplier, volumesByProductId };
}

export function calculateCommercialPackSales(
  assumptions: FinanceAssumptions,
  bookedOccupancyPct: number
): CommercialPackSalesResult {
  const { multiplier, volumesByProductId } = buildCommercialPackSalesVolumes(
    assumptions,
    bookedOccupancyPct
  );

  const rows: CommercialPackSalesRow[] = listFlexiblePacks(assumptions).map(
    (product: Product) => {
      const basePacksSold = d(Math.max(0, product.packRules?.expectedSalesVolumePerMonth ?? 0));
      const packsSold = d(volumesByProductId[product.id] ?? 0);
      const netRevenue = productNetPrice(product, assumptions).times(packsSold);
      const grossCashCollected = productGrossPrice(product, assumptions).times(packsSold);
      const newCredits = d(product.creditsIncluded).times(packsSold);

      return {
        productId: product.id,
        productName: product.name,
        basePacksSold,
        packsSold,
        netRevenue,
        grossCashCollected,
        newCredits,
      };
    }
  );

  const totalNetRevenue = sum(rows.map((r) => r.netRevenue));
  const totalGrossCashCollected = sum(rows.map((r) => r.grossCashCollected));
  const totalNewCredits = sum(rows.map((r) => r.newCredits));

  const modeLabel =
    assumptions.rampPackSalesMode === "aggressive_presale"
      ? "aggressive pre-sale below target occupancy"
      : "steady pack volume";

  return {
    multiplier,
    bookedOccupancyPct,
    rows,
    totalNetRevenue,
    totalGrossCashCollected,
    totalNewCredits,
    trace: trace(
      "Commercial pack sales (purchase timing)",
      `Σ (packs sold × net/gross price). Ramp mode: ${modeLabel}.`,
      "INR/month",
      rows.map((r) => ({
        label: r.productName,
        expression: `${r.packsSold.toFixed(1)} packs × net price (base ${r.basePacksSold.toFixed(0)}, ×${multiplier.toFixed(2)})`,
        result: r.netRevenue,
      })),
      totalNetRevenue
    ),
  };
}
