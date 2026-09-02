/**
 * Flexible product pricing and credit-mix derivation.
 *
 * Two distinct concepts:
 * - flexibleCustomerMixPct (packageMixPct): share of customers purchasing each SKU
 * - flexibleCreditMixPct: share of expected redeemed credits per SKU
 */
import Decimal from "decimal.js";
import { d, sum, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, Product } from "../schemas";
import { getActiveProducts } from "./product-catalog";
import { resolvePackRules } from "./flexible-packs";
import {
  productGrossPrice,
  productNetPrice,
} from "./product-pricing";

export interface FlexibleProductPricing {
  productId: string;
  productName: string;
  credits: number;
  grossPackagePrice: Decimal;
  netPackagePrice: Decimal;
  grossPricePerCredit: Decimal;
  netPricePerCredit: Decimal;
}

export interface FlexibleMixRow {
  product: Product;
  pricing: FlexibleProductPricing;
  /** Customer mix % — from packageMixPct input */
  flexibleCustomerMixPct: Decimal;
  expectedRedemptionRatePct: Decimal;
  /** Relative customer count proxy (mix % of 100 customers) */
  expectedCustomers: Decimal;
  expectedRedeemedCredits: Decimal;
  flexibleCreditMixPct: Decimal;
  weightedContribution: Decimal;
}

export interface FlexibleCreditMixResult {
  rows: FlexibleMixRow[];
  customerMixTotal: Decimal;
  customerMixValid: boolean;
  creditMixTotal: Decimal;
  totalExpectedRedeemedCredits: Decimal;
  /** Weighted nominal net price per purchased credit (default metric) */
  weightedNominalNetPricePerCredit: Decimal;
  weightedNominalGrossPricePerCredit: Decimal;
  trace: CalculationTrace;
}

/** Active flexible SKUs — derived from product config, not hardcoded IDs */
export function listActiveFlexibleSkus(assumptions: FinanceAssumptions): Product[] {
  return getActiveProducts(assumptions)
    .filter((p) => p.type === "drop_in" || p.type === "credit_pack")
    .sort(
      (a, b) =>
        (a.packRules?.displayOrder ?? 0) - (b.packRules?.displayOrder ?? 0) ||
        a.creditsIncluded - b.creditsIncluded ||
        a.name.localeCompare(b.name)
    );
}

export function getFlexibleProductPricing(
  product: Product,
  assumptions: FinanceAssumptions
): FlexibleProductPricing {
  const credits = Math.max(1, product.creditsIncluded);
  const grossPackage = productGrossPrice(product, assumptions);
  const netPackage = productNetPrice(product, assumptions);
  return {
    productId: product.id,
    productName: product.name,
    credits,
    grossPackagePrice: grossPackage,
    netPackagePrice: netPackage,
    grossPricePerCredit: grossPackage.dividedBy(credits),
    netPricePerCredit: netPackage.dividedBy(credits),
  };
}

/**
 * Derive credit mix from customer mix:
 * expected_redeemed_credits = customers × credits × redemption_rate
 */
export function calculateFlexibleCreditMix(
  assumptions: FinanceAssumptions
): FlexibleCreditMixResult {
  const products = listActiveFlexibleSkus(assumptions);
  const customerMixTotal = sum(products.map((p) => d(p.packageMixPct)));
  const customerMixValid = customerMixTotal.equals(100);

  const rawRows = products.map((product) => {
    const pricing = getFlexibleProductPricing(product, assumptions);
    const rules = resolvePackRules(product);
    const customerMixPct = d(product.packageMixPct);
    const redemptionRate = d(rules.expectedRedemptionRatePct).dividedBy(100);
    const expectedCustomers = customerMixPct;
    const expectedRedeemedCredits = expectedCustomers
      .times(pricing.credits)
      .times(redemptionRate);

    return {
      product,
      pricing,
      flexibleCustomerMixPct: customerMixPct,
      expectedRedemptionRatePct: d(rules.expectedRedemptionRatePct),
      expectedCustomers,
      expectedRedeemedCredits,
    };
  });

  const totalExpectedRedeemedCredits = sum(
    rawRows.map((r) => r.expectedRedeemedCredits)
  );

  const rows: FlexibleMixRow[] = rawRows.map((r) => {
    const creditMixPct = totalExpectedRedeemedCredits.isZero()
      ? new Decimal(0)
      : r.expectedRedeemedCredits.dividedBy(totalExpectedRedeemedCredits).times(100);
    const weight = totalExpectedRedeemedCredits.isZero()
      ? new Decimal(0)
      : r.expectedRedeemedCredits.dividedBy(totalExpectedRedeemedCredits);
    const weightedContribution = weight.times(r.pricing.netPricePerCredit);

    return {
      ...r,
      flexibleCreditMixPct: creditMixPct,
      weightedContribution,
    };
  });

  const weightedNominalNetPricePerCredit = sum(rows.map((r) => r.weightedContribution));
  const weightedNominalGrossPricePerCredit = sum(
    rows.map((r) => {
      const weight = totalExpectedRedeemedCredits.isZero()
        ? new Decimal(0)
        : r.expectedRedeemedCredits.dividedBy(totalExpectedRedeemedCredits);
      return weight.times(r.pricing.grossPricePerCredit);
    })
  );

  const creditMixTotal = sum(rows.map((r) => r.flexibleCreditMixPct));

  const steps = rows.map((r) => ({
    label: r.product.name,
    expression: `${r.flexibleCreditMixPct.toFixed(2)}% credit mix × ${r.pricing.netPricePerCredit.toFixed(2)} net/credit`,
    result: r.weightedContribution,
  }));

  steps.push({
    label: "Weighted nominal net / credit",
    expression: rows.map((r) => r.weightedContribution.toFixed(2)).join(" + "),
    result: weightedNominalNetPricePerCredit,
  });

  return {
    rows,
    customerMixTotal,
    customerMixValid,
    creditMixTotal,
    totalExpectedRedeemedCredits,
    weightedNominalNetPricePerCredit,
    weightedNominalGrossPricePerCredit,
    trace: trace(
      "Weighted nominal net price per credit",
      "Σ (credit mix share × net package price / credits). Customer mix is converted to credit mix via credits × redemption rate.",
      "INR/credit",
      steps,
      weightedNominalNetPricePerCredit
    ),
  };
}

/** Normalise customer mix percentages to 100% proportionally */
export function normaliseFlexibleCustomerMix(
  products: Product[]
): Product[] {
  const flex = products.filter(
    (p) => p.type === "drop_in" || p.type === "credit_pack"
  );
  const total = flex.reduce((s, p) => s + p.packageMixPct, 0);
  if (total <= 0) return products;

  const flexIds = new Set(flex.map((p) => p.id));
  const normalised = products.map((p) => {
    if (!flexIds.has(p.id)) return p;
    const pct = Math.round((p.packageMixPct / total) * 1000) / 10;
    return {
      ...p,
      packageMixPct: pct,
      serviceDemandPct: pct,
    };
  });

  const flexNormalised = normalised.filter((p) => flexIds.has(p.id));
  const mixTotal = flexNormalised.reduce((s, p) => s + p.packageMixPct, 0);
  const remainder = Math.round((100 - mixTotal) * 10) / 10;
  if (remainder !== 0 && flexNormalised.length > 0) {
    const adjustId = flexNormalised.reduce((a, b) =>
      a.packageMixPct >= b.packageMixPct ? a : b
    ).id;
    return normalised.map((p) => {
      if (p.id !== adjustId) return p;
      const adjustedPct = Math.round((p.packageMixPct + remainder) * 10) / 10;
      return {
        ...p,
        packageMixPct: adjustedPct,
        serviceDemandPct: adjustedPct,
      };
    });
  }

  return normalised;
}
