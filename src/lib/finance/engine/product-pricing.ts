import { d, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, Product } from "../schemas";
import Decimal from "decimal.js";

/**
 * Canonical pricing: product.price is NET SALES ex-GST.
 * Customer pays = net × (1 + GST rate) when GST registered.
 */

export function getEffectiveGstMode(
  _product: Product,
  _assumptions: FinanceAssumptions
): "inclusive" | "exclusive" {
  return "exclusive";
}

export function getEffectiveGstModeForAssumptions(
  _assumptions: FinanceAssumptions
): "exclusive" {
  return "exclusive";
}

/** @deprecated Use productNetPrice — kept for GST display helpers */
export function stripGst(
  amount: Decimal,
  gstRatePct: number,
  priceEntryMode: "inclusive" | "exclusive"
): { net: Decimal; gst: Decimal; gross: Decimal; trace: CalculationTrace } {
  const rate = d(gstRatePct).dividedBy(100);

  if (priceEntryMode === "inclusive") {
    const net = amount.dividedBy(d(1).plus(rate));
    const gst = amount.minus(net);
    return {
      net,
      gst,
      gross: amount,
      trace: trace("Net from inclusive", "net = gross / (1 + rate)", "INR", [], net),
    };
  }

  const net = amount;
  const gst = net.times(rate);
  return {
    net,
    gst,
    gross: net.plus(gst),
    trace: trace("Net ex-GST entry", "net = entered price", "INR", [], net),
  };
}

export function productNetPrice(
  product: Product,
  _assumptions: FinanceAssumptions
): Decimal {
  return d(product.price).times(
    d(1).minus(d(product.discountPct).dividedBy(100))
  );
}

export function productGrossPrice(
  product: Product,
  assumptions: FinanceAssumptions
): Decimal {
  const net = productNetPrice(product, assumptions);
  if (!assumptions.gstRegistered) return net;
  const rate = d(assumptions.gstRatePct).dividedBy(100);
  return net.times(d(1).plus(rate));
}

export function productGstAmount(
  product: Product,
  assumptions: FinanceAssumptions
): Decimal {
  return productGrossPrice(product, assumptions).minus(
    productNetPrice(product, assumptions)
  );
}

export function productNetRevenuePerCredit(
  product: Product,
  assumptions: FinanceAssumptions
): Decimal {
  const net = productNetPrice(product, assumptions);
  if (product.creditsIncluded <= 0) return net;
  return net.dividedBy(product.creditsIncluded);
}

export function productGrossRevenuePerCredit(
  product: Product,
  assumptions: FinanceAssumptions
): Decimal {
  const gross = productGrossPrice(product, assumptions);
  if (product.creditsIncluded <= 0) return gross;
  return gross.dividedBy(product.creditsIncluded);
}
