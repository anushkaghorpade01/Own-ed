/**
 * Prepaid pack cash collections — purchase timing for planning cash flow.
 */
import Decimal from "decimal.js";
import { d, sum, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import {
  buildCommercialPackSalesVolumes,
  calculateCommercialPackSales,
} from "./commercial-pack-sales";
import { productGrossPrice, productNetPrice } from "./product-pricing";
import { getActiveProducts } from "./product-catalog";
import { listFlexiblePacks } from "./flexible-packs";

export interface PrepaidCashRow {
  productId: string;
  productName: string;
  packsSold: Decimal;
  grossCashCollected: Decimal;
  netCashCollected: Decimal;
  netDeferredUnearned: Decimal;
}

export interface PrepaidCashResult {
  grossCashCollected: Decimal;
  netCashCollected: Decimal;
  totalDeferredUnearned: Decimal;
  packSalesMultiplier: Decimal;
  rows: PrepaidCashRow[];
  trace: CalculationTrace;
}

export function calculatePrepaidPackCash(
  assumptions: FinanceAssumptions,
  bookedOccupancyPct?: number
): PrepaidCashResult {
  const booked =
    bookedOccupancyPct ?? assumptions.projectedBookedOccupancyPct;
  const commercial = calculateCommercialPackSales(assumptions, booked);
  const rows: PrepaidCashRow[] = commercial.rows.map((row) => ({
    productId: row.productId,
    productName: row.productName,
    packsSold: row.packsSold,
    grossCashCollected: row.grossCashCollected,
    netCashCollected: row.netRevenue,
    netDeferredUnearned: new Decimal(0),
  }));

  for (const product of getActiveProducts(assumptions).filter((p) => p.type === "standing_spot")) {
    const gross = productGrossPrice(product, assumptions);
    const net = productNetPrice(product, assumptions);
    rows.push({
      productId: product.id,
      productName: product.name,
      packsSold: d(1),
      grossCashCollected: gross,
      netCashCollected: net,
      netDeferredUnearned: new Decimal(0),
    });
  }

  const grossCashCollected = sum(rows.map((r) => r.grossCashCollected));
  const netCashCollected = sum(rows.map((r) => r.netCashCollected));
  const totalDeferredUnearned = sum(rows.map((r) => r.netDeferredUnearned));

  const modeNote =
    assumptions.rampPackSalesMode === "aggressive_presale" &&
    commercial.multiplier.gt(1)
      ? ` ×${commercial.multiplier.toFixed(2)} aggressive pre-sale below target occupancy`
      : "";

  return {
    grossCashCollected,
    netCashCollected,
    totalDeferredUnearned,
    packSalesMultiplier: commercial.multiplier,
    rows,
    trace: trace(
      "Prepaid pack cash collected",
      `Σ (packs sold × gross package price) at purchase timing${modeNote}`,
      "INR/month",
      rows.map((r) => ({
        label: r.productName,
        expression: `${r.packsSold.toFixed(0)} packs × gross price`,
        result: r.grossCashCollected,
      })),
      grossCashCollected
    ),
  };
}

/** Monthly operating cash inflows: prepaid purchases + ancillary earned-timing gross */
export function calculateOperatingCashInflows(
  assumptions: FinanceAssumptions,
  earnedGrossBillings: Decimal,
  bookedOccupancyPct?: number
): { grossInflows: Decimal; prepaid: PrepaidCashResult } {
  const prepaid = calculatePrepaidPackCash(assumptions, bookedOccupancyPct);
  const flexStandingGross = prepaid.grossCashCollected;
  const ancillary = Decimal.max(0, earnedGrossBillings.minus(flexStandingGross));
  const grossInflows = flexStandingGross.plus(ancillary);

  return { grossInflows, prepaid };
}

/** @deprecated use calculateCommercialPackSales volumes */
export function getPackSalesVolumesForMonth(
  assumptions: FinanceAssumptions,
  bookedOccupancyPct: number
): Record<string, number> {
  return buildCommercialPackSalesVolumes(assumptions, bookedOccupancyPct).volumesByProductId;
}
