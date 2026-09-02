/**
 * Prepaid pack cash collections — purchase timing for planning cash flow.
 */
import Decimal from "decimal.js";
import { d, sum, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import { listFlexiblePacks, analyzeFlexiblePack } from "./flexible-packs";
import { productGrossPrice, productNetPrice } from "./product-pricing";
import { getActiveProducts } from "./product-catalog";

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
  rows: PrepaidCashRow[];
  trace: CalculationTrace;
}

export function calculatePrepaidPackCash(assumptions: FinanceAssumptions): PrepaidCashResult {
  const rows: PrepaidCashRow[] = [];

  for (const product of listFlexiblePacks(assumptions)) {
    const rules = product.packRules;
    const packsSold = d(Math.max(0, rules?.expectedSalesVolumePerMonth ?? 0));
    const gross = productGrossPrice(product, assumptions).times(packsSold);
    const net = productNetPrice(product, assumptions).times(packsSold);
    const econ = analyzeFlexiblePack(product, assumptions);
    const deferred = new Decimal(0);

    rows.push({
      productId: product.id,
      productName: product.name,
      packsSold,
      grossCashCollected: gross,
      netCashCollected: net,
      netDeferredUnearned: deferred,
    });
  }

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

  return {
    grossCashCollected,
    netCashCollected,
    totalDeferredUnearned,
    rows,
    trace: trace(
      "Prepaid pack cash collected",
      "Σ (packs sold × gross package price) at purchase timing — not earned revenue",
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
  earnedGrossBillings: Decimal
): { grossInflows: Decimal; prepaid: PrepaidCashResult } {
  const prepaid = calculatePrepaidPackCash(assumptions);
  const flexStandingGross = prepaid.grossCashCollected;
  const ancillary = Decimal.max(0, earnedGrossBillings.minus(flexStandingGross));
  const grossInflows = flexStandingGross.plus(ancillary);

  return { grossInflows, prepaid };
}
