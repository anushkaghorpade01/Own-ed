/**
 * Migrates legacy 4/8/12 monthly-credit products to 1/8/16 quantity+validity architecture.
 */
import type { Product } from "../schemas";
import { FlexiblePackRulesSchema } from "../schemas";
import type { ProductInput } from "./product-catalog";
import { ensureProductVersionFields } from "./product-catalog";

const LEGACY_PACK_MAP: Record<
  string,
  { newId: string; credits: number; validityWeeks: number; name: string }
> = {
  "4-pack": { newId: "drop-in", credits: 1, validityWeeks: 4, name: "Drop-in" },
  "8-pack": { newId: "8-pack", credits: 8, validityWeeks: 8, name: "8 Credit Pack" },
  "12-pack": { newId: "16-pack", credits: 16, validityWeeks: 12, name: "16 Credit Pack" },
};

export interface ProductMigrationFlag {
  productId: string;
  message: string;
  action: "renamed" | "removed" | "converted" | "review";
}

export function migrateLegacyProducts(products: ProductInput[]): {
  products: Product[];
  flags: ProductMigrationFlag[];
} {
  const flags: ProductMigrationFlag[] = [];
  const seen = new Set<string>();
  const result: Product[] = [];

  for (const product of products) {
    if (product.type !== "credit_pack") {
      if (!seen.has(product.id)) {
        result.push(ensureProductVersionFields(product));
        seen.add(product.id);
      }
      continue;
    }

    const mapping = LEGACY_PACK_MAP[product.id];
    if (mapping) {
      const migrated = ensureProductVersionFields({
        ...product,
        id: mapping.newId,
        name: product.name.includes("credit") ? mapping.name : product.name,
        creditsIncluded: mapping.credits,
        validityDays: undefined,
        expectedMonthlyUsageCredits: undefined,
        packRules: FlexiblePackRulesSchema.parse({
          validityValue: mapping.validityWeeks,
          validityUnit: "weeks",
          expectedRedemptionRatePct: product.expectedRedemptionRatePct ?? 90,
          expectedBreakageRatePct: product.expectedBreakagePct ?? 10,
          displayOrder: mapping.credits,
        }),
      });
      if (!seen.has(migrated.id)) {
        result.push(migrated);
        seen.add(migrated.id);
        flags.push({
          productId: product.id,
          message: `Migrated ${product.id} → ${migrated.id} (${mapping.credits} credits, ${mapping.validityWeeks} weeks validity). Review pricing and mix.`,
          action: product.id === "4-pack" ? "converted" : "renamed",
        });
      } else {
        flags.push({
          productId: product.id,
          message: `Duplicate legacy pack ${product.id} skipped after migration.`,
          action: "removed",
        });
      }
      continue;
    }

    if (product.creditsIncluded === 4 && !product.packRules) {
      flags.push({
        productId: product.id,
        message: `Product ${product.id} has 4 credits — legacy monthly allocation. Convert to quantity+validity pack or remove.`,
        action: "review",
      });
    }

    if (!product.packRules && product.validityDays) {
      result.push(
        ensureProductVersionFields({
          ...product,
          packRules: FlexiblePackRulesSchema.parse({
            validityValue: Math.max(1, Math.round(product.validityDays / 7)),
            validityUnit: "weeks",
            expectedRedemptionRatePct: product.expectedRedemptionRatePct ?? 90,
            expectedBreakageRatePct: product.expectedBreakagePct ?? 10,
          }),
        })
      );
      flags.push({
        productId: product.id,
        message: `Added packRules from validityDays for ${product.id}.`,
        action: "converted",
      });
      continue;
    }

    result.push(ensureProductVersionFields(product));
    seen.add(product.id);
  }

  return deduplicateFlexibleSkus(result, flags);
}

const CANONICAL_DROP_IN_ID = "drop-in";

/**
 * Merge duplicate 1-credit SKUs (e.g. legacy "1-credit" + canonical "drop-in").
 */
export function deduplicateFlexibleSkus(
  products: Product[],
  flags: ProductMigrationFlag[] = []
): { products: Product[]; flags: ProductMigrationFlag[] } {
  const oneCreditSkus = products.filter(
    (p) =>
      p.type === "drop_in" ||
      (p.type === "credit_pack" && p.creditsIncluded === 1)
  );

  if (oneCreditSkus.length <= 1) {
    return { products, flags };
  }

  const canonical =
    products.find((p) => p.id === CANONICAL_DROP_IN_ID) ??
    oneCreditSkus.find((p) => p.type === "drop_in") ??
    oneCreditSkus[0];

  let mergedMix = 0;
  const removeIds = new Set<string>();

  for (const p of oneCreditSkus) {
    mergedMix += p.packageMixPct;
    if (p.id !== canonical.id) {
      removeIds.add(p.id);
      flags.push({
        productId: p.id,
        message: `Merged duplicate 1-credit SKU "${p.name}" (${p.id}) into canonical Drop-in.`,
        action: "removed",
      });
    }
  }

  const deduped = products
    .filter((p) => !removeIds.has(p.id))
    .map((p) =>
      p.id === canonical.id
        ? ensureProductVersionFields({
            ...p,
            id: CANONICAL_DROP_IN_ID,
            name: "Drop-in",
            type: "drop_in",
            creditsIncluded: 1,
            packageMixPct: mergedMix,
          })
        : p
    );

  return { products: deduped, flags };
}
