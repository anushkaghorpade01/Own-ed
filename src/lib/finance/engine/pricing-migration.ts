/**
 * One-time migration: stored product.price becomes net sales ex-GST (canonical).
 *
 * When pricingSemanticsVersion < 2 and prices were entered GST-inclusive,
 * we divide by (1 + GST rate) so customer-facing price is preserved:
 *   net = round(stored / (1 + rate))
 *   customer pays = net × (1 + rate) ≈ original stored value
 */
import type { FinanceAssumptions, Product } from "../schemas";

export const PRICING_SEMANTICS_VERSION = 2;

function toNetFromInclusive(stored: number, gstRatePct: number): number {
  const rate = gstRatePct / 100;
  return Math.round(stored / (1 + rate));
}

function migrateProductPrice(
  product: Product,
  assumptions: FinanceAssumptions,
  globalWasInclusive: boolean
): Product {
  const productWasInclusive =
    !product.gstFollowsGlobal && product.gstTreatment === "inclusive";
  const needsConversion = globalWasInclusive || productWasInclusive;

  const price = needsConversion
    ? toNetFromInclusive(product.price, assumptions.gstRatePct)
    : product.price;

  return {
    ...product,
    price,
    gstTreatment: "exclusive",
    gstFollowsGlobal: true,
  };
}

export function migratePricingSemantics(
  assumptions: FinanceAssumptions
): FinanceAssumptions {
  const version = assumptions.pricingSemanticsVersion ?? 1;
  if (version >= PRICING_SEMANTICS_VERSION) {
    return {
      ...assumptions,
      priceEntryMode: "exclusive",
      pricingSemanticsVersion: PRICING_SEMANTICS_VERSION,
    };
  }

  const globalWasInclusive = assumptions.priceEntryMode !== "exclusive";

  const products = assumptions.products.map((p) =>
    migrateProductPrice(p, assumptions, globalWasInclusive)
  );

  const privateProduct = products.find((p) => p.type === "private");
  const migratedPrivatePrice = globalWasInclusive
    ? toNetFromInclusive(assumptions.privatePrice, assumptions.gstRatePct)
    : assumptions.privatePrice;

  return {
    ...assumptions,
    products,
    priceEntryMode: "exclusive",
    pricingSemanticsVersion: PRICING_SEMANTICS_VERSION,
    privatePrice: privateProduct?.price ?? migratedPrivatePrice,
    duoPricePerPerson: globalWasInclusive
      ? toNetFromInclusive(assumptions.duoPricePerPerson, assumptions.gstRatePct)
      : assumptions.duoPricePerPerson,
  };
}
