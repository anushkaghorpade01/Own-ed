import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import {
  getActiveProducts,
  getFlexibleCreditProducts,
  previewProductChangeImpact,
  isFinanciallyMeaningfulChange,
  ensureProductVersionFields,
  createBlankFlexibleProduct,
} from "../engine/product-catalog";
import { runFinanceModel } from "../run-model";

describe("Product catalog", () => {
  const assumptions = createSampleAssumptions();

  it("lists active flexible products without hardcoded credit counts", () => {
    const flex = getFlexibleCreditProducts(assumptions);
    expect(flex.length).toBeGreaterThanOrEqual(3);
    const credits = flex.map((p) => p.creditsIncluded);
    expect(credits).toContain(1);
    expect(credits).toContain(8);
    expect(credits).toContain(16);
  });

  it("excludes draft products from active model list", () => {
    const withDraft = {
      ...assumptions,
      products: [
        ...assumptions.products,
        ensureProductVersionFields({
          ...createBlankFlexibleProduct(),
          lifecycle: "draft",
        }),
      ],
    };
    expect(getActiveProducts(withDraft).length).toBe(getActiveProducts(assumptions).length);
  });

  it("previews validity change impact", () => {
    const pack = assumptions.products.find((p) => p.id === "8-pack")!;
    const updated = {
      ...pack,
      packRules: {
        ...pack.packRules!,
        validityValue: 10,
      },
    };
    expect(isFinanciallyMeaningfulChange(pack, updated)).toBe(true);
    const impact = previewProductChangeImpact(assumptions, pack.id, updated);
    expect(impact.rows.length).toBeGreaterThan(0);
    expect(impact.rows.some((r) => r.label.includes("validity") || r.label.includes("obligation"))).toBe(true);
  });

  it("recalculates model when product changes", () => {
    const pack = assumptions.products.find((p) => p.id === "8-pack")!;
    const before = runFinanceModel(assumptions);
    const updated = {
      ...assumptions,
      products: assumptions.products.map((p) =>
        p.id === pack.id
          ? {
              ...p,
              price: p.price + 1000,
            }
          : p
      ),
    };
    const after = runFinanceModel(updated);
    expect(after.summary.monthlyRevenue.equals(before.summary.monthlyRevenue)).toBe(false);
  });
});
