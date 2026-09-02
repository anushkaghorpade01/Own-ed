/**
 * Canonical product catalog — single source of truth for access product configuration.
 * All finance modules read active products from assumptions.products by product ID.
 */
import type { FinanceAssumptions, Product, ProductVersionSnapshot } from "../schemas";
import { FlexiblePackRulesSchema, ProductSchema } from "../schemas";
import type { z } from "zod";
import { runFinanceModel } from "../run-model";
import { analyzeFlexiblePack, resolvePackRules } from "./flexible-packs";
import Decimal from "decimal.js";

export function newProductId(prefix = "product"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newVersionId(): string {
  return `pv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Products that drive the live Base Case finance model */
export function getActiveProducts(assumptions: FinanceAssumptions): Product[] {
  return assumptions.products.filter(
    (p) => p.lifecycle === "active" || p.lifecycle === undefined
  );
}

/** Flexible credit products (any credit count) for catalog UI */
export function getFlexibleCreditProducts(
  assumptions: FinanceAssumptions,
  options?: { includeDraft?: boolean; includeArchived?: boolean }
): Product[] {
  return assumptions.products
    .filter((p) => p.type === "credit_pack" || p.type === "drop_in")
    .filter((p) => {
      if (p.lifecycle === "archived" && !options?.includeArchived) return false;
      if (p.lifecycle === "draft" && !options?.includeDraft) return false;
      return true;
    })
    .sort(
      (a, b) =>
        (a.packRules?.displayOrder ?? 0) - (b.packRules?.displayOrder ?? 0) ||
        a.name.localeCompare(b.name)
    );
}

export function getProductById(
  assumptions: FinanceAssumptions,
  productId: string
): Product | undefined {
  return assumptions.products.find((p) => p.id === productId);
}

export function resolveProductVersion(
  assumptions: FinanceAssumptions,
  productId: string,
  versionId?: string,
  history?: Record<string, ProductVersionSnapshot[]>
): Product | undefined {
  if (versionId && history?.[productId]) {
    const snap = history[productId].find((v) => v.versionId === versionId);
    if (snap) return snap.product;
  }
  return getProductById(assumptions, productId);
}

export function snapshotProduct(product: Product, note?: string): ProductVersionSnapshot {
  return {
    versionId: product.versionId ?? newVersionId(),
    versionNumber: product.versionNumber ?? 1,
    product: structuredClone(product),
    createdAt: new Date().toISOString(),
    note,
  };
}

export type ProductInput = z.input<typeof ProductSchema>;

export function ensureProductVersionFields(product: ProductInput): Product {
  const now = new Date().toISOString();
  return ProductSchema.parse({
    ...product,
    versionId: product.versionId ?? newVersionId(),
    lifecycle: product.lifecycle ?? "active",
    productCreatedAt: product.productCreatedAt ?? now,
    productUpdatedAt: product.productUpdatedAt ?? now,
    packRules:
      product.type === "credit_pack" || product.type === "drop_in"
        ? product.packRules ??
          FlexiblePackRulesSchema.parse({ validityValue: 4, validityUnit: "weeks" })
        : product.packRules,
  });
}

const FINANCIAL_FIELDS: Array<(p: Product) => unknown> = [
  (p) => p.price,
  (p) => p.creditsIncluded,
  (p) => p.gstFollowsGlobal,
  (p) => p.gstTreatment,
  (p) => p.discountPct,
  (p) => p.packRules?.validityValue,
  (p) => p.packRules?.validityUnit,
  (p) => p.packRules?.activationDeadlineDays,
  (p) => p.packRules?.activationPolicy,
  (p) => p.packRules?.expectedRedemptionRatePct,
  (p) => p.packRules?.expectedBreakageRatePct,
  (p) => p.packRules?.expectedPeakBookingSharePct,
  (p) => p.packRules?.expectedSalesVolumePerMonth,
  (p) => p.packageMixPct,
  (p) => p.peakEligible,
  (p) => p.standingSpotClassesPerWeek,
  (p) => p.standingSpotMinCommitmentMonths,
  (p) => p.standingSpotMaxSeatsPerClass,
  (p) => p.standingSpotRules?.premiumPct,
  (p) => p.standingSpotRules?.defaultCommitmentMonths,
  (p) => p.standingSpotRules?.releasePolicy,
  (p) => p.standingSpotRules?.releaseProbabilityPct,
  (p) => p.standingSpotMemberAttendanceProbabilityPct,
  (p) => p.standbyReleaseHoursBefore,
  (p) => p.standbyCannibalisationPct,
  (p) => p.maxUsesPerMonth,
  (p) => p.standbyExpectedClaimRatePct,
];

export function isCosmeticProductChange(before: Product, after: Product): boolean {
  const nameOnly =
    before.name !== after.name &&
    FINANCIAL_FIELDS.every((fn) => JSON.stringify(fn(before)) === JSON.stringify(fn(after)));
  return nameOnly;
}

export function isFinanciallyMeaningfulChange(before: Product, after: Product): boolean {
  if (before.name === after.name) {
    return FINANCIAL_FIELDS.some(
      (fn) => JSON.stringify(fn(before)) !== JSON.stringify(fn(after))
    );
  }
  return FINANCIAL_FIELDS.some(
    (fn) => JSON.stringify(fn(before)) !== JSON.stringify(fn(after))
  );
}

export interface ProductChangeImpactRow {
  label: string;
  before: string;
  after: string;
}

export interface ProductChangeImpact {
  rows: ProductChangeImpactRow[];
  summaryLines: string[];
}

function replaceProductInAssumptions(
  assumptions: FinanceAssumptions,
  productId: string,
  product: Product
): FinanceAssumptions {
  return {
    ...assumptions,
    products: assumptions.products.map((p) => (p.id === productId ? product : p)),
  };
}

/** Recalculate model impact of changing one product (Base Case). */
export function previewProductChangeImpact(
  assumptions: FinanceAssumptions,
  productId: string,
  updatedProduct: Product
): ProductChangeImpact {
  const before = getProductById(assumptions, productId);
  if (!before) return { rows: [], summaryLines: [] };

  const afterAssumptions = replaceProductInAssumptions(
    assumptions,
    productId,
    ensureProductVersionFields(updatedProduct)
  );

  const beforeModel = runFinanceModel(assumptions);
  const afterModel = runFinanceModel(afterAssumptions);

  const beforeHealth = beforeModel.accessProducts.creditHealth;
  const afterHealth = afterModel.accessProducts.creditHealth;

  const beforeEcon = analyzeFlexiblePack(before, assumptions);
  const afterEcon = analyzeFlexiblePack(updatedProduct, afterAssumptions);

  const peakPressureBefore = beforeHealth.peakRedemptionCoverage.isZero()
    ? 100
    : new Decimal(100).dividedBy(beforeHealth.peakRedemptionCoverage).toNumber();
  const peakPressureAfter = afterHealth.peakRedemptionCoverage.isZero()
    ? 100
    : new Decimal(100).dividedBy(afterHealth.peakRedemptionCoverage).toNumber();

  const rows: ProductChangeImpactRow[] = [
    {
      label: "Outstanding credits",
      before: beforeHealth.creditsOutstanding.toFixed(0),
      after: afterHealth.creditsOutstanding.toFixed(0),
    },
    {
      label: "Peak redemption pressure",
      before: `${peakPressureBefore.toFixed(0)}%`,
      after: `${peakPressureAfter.toFixed(0)}%`,
    },
    {
      label: "Avg service obligation (validity)",
      before: `${beforeEcon.validityWeeks.toFixed(0)} weeks`,
      after: `${afterEcon.validityWeeks.toFixed(0)} weeks`,
    },
    {
      label: "Expected breakage",
      before: `${beforeEcon.expectedBreakagePct.toFixed(0)}%`,
      after: `${afterEcon.expectedBreakagePct.toFixed(0)}%`,
    },
    {
      label: "Earned net revenue (monthly model)",
      before: beforeModel.summary.monthlyRevenue.toFixed(0),
      after: afterModel.summary.monthlyRevenue.toFixed(0),
    },
    {
      label: "Payback",
      before: beforeModel.payback.paybackNotReached
        ? "Not reached"
        : `Month ${beforeModel.payback.paybackMonth}`,
      after: afterModel.payback.paybackNotReached
        ? "Not reached"
        : `Month ${afterModel.payback.paybackMonth}`,
    },
  ];

  const diffWeeks = afterEcon.validityWeeks.minus(beforeEcon.validityWeeks);
  const summaryLines: string[] = [];
  if (!diffWeeks.isZero()) {
    summaryLines.push(
      `Validity change of ${diffWeeks.toFixed(0)} weeks affects redemption timing and delivery cost spread.`
    );
  }
  if (!beforeHealth.creditsOutstanding.equals(afterHealth.creditsOutstanding)) {
    summaryLines.push(
      `Outstanding credits move from ${beforeHealth.creditsOutstanding.toFixed(0)} to ${afterHealth.creditsOutstanding.toFixed(0)}.`
    );
  }

  return { rows, summaryLines };
}

export function describeProductChange(before: Product, after: Product): string[] {
  const lines: string[] = [];
  if (before.name !== after.name) lines.push(`Name: ${before.name} → ${after.name}`);
  if (before.creditsIncluded !== after.creditsIncluded)
    lines.push(`Credits: ${before.creditsIncluded} → ${after.creditsIncluded}`);
  if (before.price !== after.price) lines.push(`Price: ₹${before.price} → ₹${after.price}`);
  const br = resolvePackRules(before);
  const ar = resolvePackRules(after);
  if (br.validityValue !== ar.validityValue || br.validityUnit !== ar.validityUnit) {
    lines.push(
      `Validity: ${br.validityValue} ${br.validityUnit} → ${ar.validityValue} ${ar.validityUnit}`
    );
  }
  if (br.expectedRedemptionRatePct !== ar.expectedRedemptionRatePct)
    lines.push(
      `Expected redemption: ${br.expectedRedemptionRatePct}% → ${ar.expectedRedemptionRatePct}%`
    );
  if (br.expectedBreakageRatePct !== ar.expectedBreakageRatePct)
    lines.push(
      `Expected breakage: ${br.expectedBreakageRatePct}% → ${ar.expectedBreakageRatePct}%`
    );
  return lines;
}

export function createBlankFlexibleProduct(
  overrides?: Partial<Product>
): Product {
  const now = new Date().toISOString();
  const id = newProductId("flex");
  return ensureProductVersionFields({
    id,
    name: "New Credit Pack",
    type: "credit_pack",
    price: 0,
    gstTreatment: "inclusive",
    gstFollowsGlobal: true,
    creditsIncluded: 10,
    packageMixPct: 0,
    peakEligible: true,
    recurring: false,
    discountPct: 0,
    classEligibility: [],
    standingSpotMaxSeatsPerClass: 1,
    lifecycle: "draft",
    productCreatedAt: now,
    productUpdatedAt: now,
    packRules: FlexiblePackRulesSchema.parse({
      validityValue: 8,
      validityUnit: "weeks",
      displayOrder: 99,
    }),
    ...overrides,
  });
}

export function productHasHistoricalUsage(
  productId: string,
  state: {
    scenarios: Array<{ assumptions: FinanceAssumptions }>;
    snapshots: Array<{ assumptions: FinanceAssumptions }>;
    productVersionHistory?: Record<string, ProductVersionSnapshot[]>;
  }
): boolean {
  const inScenario = state.scenarios.some((s) =>
    s.assumptions.products.some((p) => p.id === productId)
  );
  const inSnapshot = state.snapshots.some((s) =>
    s.assumptions.products.some((p) => p.id === productId)
  );
  const hasVersions = (state.productVersionHistory?.[productId]?.length ?? 0) > 1;
  return inScenario || inSnapshot || hasVersions;
}

export function traceProductMixContribution(
  assumptions: FinanceAssumptions
): Array<{ productId: string; versionId: string; name: string; netPerCredit: string; mixPct: number }> {
  const active = getActiveProducts(assumptions).filter(
    (p) => p.type === "credit_pack" || p.type === "drop_in"
  );
  return active.map((p) => {
    const econ = analyzeFlexiblePack(p, assumptions);
    return {
      productId: p.id,
      versionId: p.versionId ?? "unknown",
      name: `${p.name} v${p.versionNumber ?? 1}`,
      netPerCredit: econ.netPerCredit.toFixed(0),
      mixPct: p.packageMixPct,
    };
  });
}
